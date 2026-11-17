import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const TENANT_ID = 'tenant_finan';
  const ACTOR = {
    id: 'actor-1',
    name: 'Actor',
    role: 'OWNER' as const,
    tenantId: TENANT_ID,
    tenantSlug: 'finan',
    mustChangePassword: false,
  };

  class ValidationError extends Error {
    fields: Record<string, string>;
    constructor(fields: Record<string, string> = {}) {
      super('validation');
      this.fields = fields;
    }
  }

  const ok = <T>(data?: T) => (data === undefined ? { ok: true } : { ok: true, data });
  const fail = (error = 'unknownError') => ({ ok: false, error });
  const withAuth = vi.fn(async (_roles: unknown, handler: (actor: typeof ACTOR) => Promise<unknown>) =>
    handler(ACTOR),
  );

  const prisma = {
    user: { create: vi.fn() },
    patient: { create: vi.fn(), findUnique: vi.fn() },
    appointment: { create: vi.fn() },
    sale: { create: vi.fn() },
    service: { create: vi.fn(), findMany: vi.fn() },
    feedback: { create: vi.fn() },
    messageTask: { create: vi.fn() },
    auditLog: { create: vi.fn() },
    staff: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  };
  const tx = { sale: { create: vi.fn() } };

  return {
    TENANT_ID,
    ACTOR,
    ValidationError,
    ok,
    fail,
    withAuth,
    prisma,
    tx,
    auth: vi.fn(),
    getTenantId: vi.fn(),
    getDefaultTenantId: vi.fn(),
    resetTenantContextCache: vi.fn(),
    validate: vi.fn(),
    hash: vi.fn(),
    passwordError: vi.fn(),
    generateTemporaryPassword: vi.fn(),
    storage: { put: vi.fn(), get: vi.fn(), remove: vi.fn() },
    headers: vi.fn(),
    getSettingsMap: vi.fn(),
    timezoneFrom: vi.fn(),
    onAppointmentChanged: vi.fn(),
    onFollowUpChanged: vi.fn(),
    cancelPendingForPatient: vi.fn(),
    findPatientByPhone: vi.fn(),
    findSimilarPatients: vi.fn(),
    listAppointments: vi.fn(),
    getDoctorShiftsForCoverage: vi.fn(),
    getApprovedLeaveInRange: vi.fn(),
    findDoctorDoubleBookings: vi.fn(),
    appointmentCoverageWarnings: vi.fn(),
    appointmentInstants: vi.fn(),
    isTerminalStatus: vi.fn(),
    followUpDueKey: vi.fn(),
    slotForTimeWindow: vi.fn(),
    transitionAllowed: vi.fn(),
    nextReceiptNumber: vi.fn(),
    blockedReason: vi.fn(),
  };
});

vi.mock('@/lib/prisma', () => ({ prisma: mocks.prisma }));
vi.mock('@/auth', () => ({ auth: mocks.auth }));
vi.mock('@/lib/tenant-context', () => ({
  getTenantId: mocks.getTenantId,
  getDefaultTenantId: mocks.getDefaultTenantId,
  resetTenantContextCache: mocks.resetTenantContextCache,
}));
vi.mock('@/lib/action', () => ({
  ok: mocks.ok,
  fail: mocks.fail,
  withAuth: mocks.withAuth,
}));
vi.mock('@/lib/errors', () => ({
  validate: mocks.validate,
  ValidationError: mocks.ValidationError,
}));
vi.mock('@node-rs/argon2', () => ({ hash: mocks.hash }));
vi.mock('@/lib/passwords', () => ({
  passwordError: mocks.passwordError,
  generateTemporaryPassword: mocks.generateTemporaryPassword,
}));
vi.mock('@/lib/storage', () => ({ storage: mocks.storage }));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('@/modules/settings', () => ({
  getSettingsMap: mocks.getSettingsMap,
  timezoneFrom: mocks.timezoneFrom,
}));
vi.mock('@/modules/settings/queries', () => ({ getSettingsMap: mocks.getSettingsMap }));
vi.mock('@/modules/messaging', () => ({
  onAppointmentChanged: mocks.onAppointmentChanged,
  onFollowUpChanged: mocks.onFollowUpChanged,
  cancelPendingForPatient: mocks.cancelPendingForPatient,
}));
vi.mock('@/modules/patients/queries', () => ({
  findPatientByPhone: mocks.findPatientByPhone,
  findSimilarPatients: mocks.findSimilarPatients,
}));
vi.mock('@/modules/appointments/queries', () => ({
  listAppointments: mocks.listAppointments,
  getDoctorShiftsForCoverage: mocks.getDoctorShiftsForCoverage,
  getApprovedLeaveInRange: mocks.getApprovedLeaveInRange,
}));
vi.mock('@/modules/appointments/logic', () => ({
  appointmentCoverageWarnings: mocks.appointmentCoverageWarnings,
  appointmentInstants: mocks.appointmentInstants,
  findDoctorDoubleBookings: mocks.findDoctorDoubleBookings,
  followUpDueKey: mocks.followUpDueKey,
  isTerminalStatus: mocks.isTerminalStatus,
  slotForTimeWindow: mocks.slotForTimeWindow,
  transitionAllowed: mocks.transitionAllowed,
}));
vi.mock('@/modules/sales/receipt', () => ({ nextReceiptNumber: mocks.nextReceiptNumber }));
vi.mock('@/modules/messaging/eligibility', () => ({ blockedReason: mocks.blockedReason }));

import { createUserAction } from '@/modules/users/actions';
import { createPatientAction } from '@/modules/patients/actions';
import { saveAppointmentAction } from '@/modules/appointments/actions';
import { createSaleAction } from '@/modules/sales/actions';
import { createServiceAction } from '@/modules/services/actions';
import { createPublicFeedback } from '@/modules/feedback/actions';
import { markMessageSentAction } from '@/modules/messaging/actions';

function formWithTenantAttempt(entries: Record<string, string>): FormData {
  const formData = new FormData();
  // User input must never win over the resolved tenant.
  formData.set('tenantId', 'tenant_evil');
  for (const [key, value] of Object.entries(entries)) formData.set(key, value);
  return formData;
}

describe('tenant scoping on writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getTenantId.mockResolvedValue(mocks.TENANT_ID);
    mocks.getDefaultTenantId.mockResolvedValue(mocks.TENANT_ID);
    mocks.hash.mockResolvedValue('hashed-password');
    mocks.passwordError.mockReturnValue(null);
    mocks.headers.mockResolvedValue({ get: () => null });
    mocks.getSettingsMap.mockResolvedValue({});
    mocks.timezoneFrom.mockReturnValue('Africa/Addis_Ababa');
    mocks.blockedReason.mockReturnValue(null);
    mocks.nextReceiptNumber.mockResolvedValue('2026-000001');

    mocks.prisma.$transaction.mockImplementation(async (callback) => callback(mocks.tx));

    mocks.prisma.user.create.mockResolvedValue({ id: 'user-1' });
    mocks.prisma.patient.create.mockResolvedValue({
      id: 'patient-1',
      fullName: 'Test Patient',
      phoneE164: '+251911000000',
      sex: 'MALE',
      birthDate: null,
      preferredLanguage: 'en',
      notesNonClinical: null,
      doNotMessage: false,
      doNotMessageReason: null,
      idPhotoUrl: null,
      idNo: null,
      active: true,
    });
    mocks.prisma.appointment.create.mockResolvedValue({ id: 'appointment-1' });
    mocks.tx.sale.create.mockResolvedValue({
      id: 'sale-1',
      receiptNumber: '2026-000001',
      patientId: 'patient-1',
      doctorId: 'doctor-1',
      paymentMethod: 'CASH',
      status: 'CONFIRMED',
      total: '100.00',
    });
    mocks.prisma.service.create.mockResolvedValue({
      id: 'service-1',
      name: 'Cleaning',
      nameAm: null,
      category: 'consultation',
      currentPrice: '100.00',
      active: true,
      isPublic: true,
    });
    mocks.prisma.feedback.create.mockResolvedValue({ id: 'feedback-1' });
    mocks.prisma.messageTask.create.mockResolvedValue({ id: 'task-1' });
    mocks.prisma.auditLog.create.mockResolvedValue({});

    mocks.prisma.patient.findUnique.mockResolvedValue({
      id: 'patient-1',
      active: true,
      doNotMessage: false,
      phoneE164: '+251911000000',
      preferredLanguage: 'en',
    });
    mocks.prisma.staff.findUnique.mockResolvedValue({
      id: 'doctor-1',
      active: true,
      isDoctor: true,
      fullName: 'Dr. Testersen',
    });
    mocks.prisma.service.findMany.mockResolvedValue([
      { id: 'service-1', name: 'Cleaning', currentPrice: '100.00', active: true },
    ]);

    mocks.findPatientByPhone.mockResolvedValue(null);
    mocks.findSimilarPatients.mockResolvedValue([]);
    mocks.listAppointments.mockResolvedValue([]);
    mocks.getDoctorShiftsForCoverage.mockResolvedValue([]);
    mocks.getApprovedLeaveInRange.mockResolvedValue([]);
    mocks.findDoctorDoubleBookings.mockReturnValue([]);
    mocks.appointmentCoverageWarnings.mockReturnValue([]);
    mocks.isTerminalStatus.mockReturnValue(false);
    mocks.appointmentInstants.mockReturnValue({
      startsAt: new Date('2026-11-20T08:00:00.000Z'),
      endsAt: new Date('2026-11-20T08:30:00.000Z'),
    });
  });

  it('sets the resolved tenant on every core write, including nested lines and audit rows', async () => {
    const validated = [
      {
        name: 'New User',
        email: 'new.user@example.com',
        role: 'RECEPTION',
        staffId: undefined,
        password: 'Str0ng!Pass#2026',
      },
      {
        fullName: 'Test Patient',
        phone: '+251911000000',
        sex: 'MALE',
        age: 30,
        preferredLanguage: 'en',
        notesNonClinical: '',
        idNo: '',
        idPhoto: undefined,
      },
      {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        dateKey: '2026-11-20',
        startTime: '10:00',
        durationMin: 30,
        serviceId: 'service-1',
        notes: '',
        overrideDoubleBooking: false,
      },
      {
        patientId: 'patient-1',
        doctorId: 'doctor-1',
        paymentMethod: 'CASH',
        walkIn: false,
        lines: [{ serviceId: 'service-1', qty: 1 }],
      },
      {
        nameEn: 'Cleaning',
        nameAm: '',
        category: 'consultation',
        currentPrice: '100.00',
        isPublic: true,
        publicDescriptionEn: '',
        publicDescriptionAm: '',
        receiptLabelEn: 'Cleaning',
        receiptLabelAm: '',
        displayOrder: 1,
        imageUrl: null,
        image: undefined,
      },
    ];
    mocks.validate.mockImplementation(() => validated.shift());

    const results = [
      await createUserAction(null, formWithTenantAttempt({})),
      await createPatientAction(null, formWithTenantAttempt({})),
      await saveAppointmentAction(null, formWithTenantAttempt({})),
      await createSaleAction(null, formWithTenantAttempt({ lines: '[]' })),
      await createServiceAction(null, formWithTenantAttempt({})),
    ];

    const feedbackResult = await createPublicFeedback({
      name: 'Visitor',
      email: null,
      rating: 5,
      text: 'Great clinic',
      language: 'en',
      ipHash: null,
    });

    const messageForm = formWithTenantAttempt({ patientId: 'patient-1', message: 'See you soon' });
    const messageResult = await markMessageSentAction(null, messageForm);

    for (const result of [...results, messageResult]) expect(result.ok).toBe(true);
    expect(feedbackResult.ok).toBe(true);

    const createdData = [
      mocks.prisma.user.create.mock.calls[0][0].data,
      mocks.prisma.patient.create.mock.calls[0][0].data,
      mocks.prisma.appointment.create.mock.calls[0][0].data,
      mocks.tx.sale.create.mock.calls[0][0].data,
      mocks.prisma.service.create.mock.calls[0][0].data,
      mocks.prisma.feedback.create.mock.calls[0][0].data,
      mocks.prisma.messageTask.create.mock.calls[0][0].data,
    ];

    for (const data of createdData) expect(data.tenantId).toBe(mocks.TENANT_ID);
    expect(mocks.tx.sale.create.mock.calls[0][0].data.lines.create[0].tenantId).toBe(
      mocks.TENANT_ID,
    );

    expect(mocks.prisma.auditLog.create).toHaveBeenCalledTimes(7);
    for (const call of mocks.prisma.auditLog.create.mock.calls) {
      expect(call[0].data.tenantId).toBe(mocks.TENANT_ID);
    }
  });
});
