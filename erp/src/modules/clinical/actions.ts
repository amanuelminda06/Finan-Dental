'use server';

import { ok, fail, withAuth, type ActionResult } from '@/lib/action';
import { writeAudit } from '@/lib/audit';
import { validate } from '@/lib/errors';
import { toDecimalString } from '@/lib/money';
import { prisma } from '@/lib/prisma';
import { getTenantId } from '@/lib/tenant-context';
import { createSaleForActor } from '@/modules/sales/create';
import { CLINICAL_ROLES, TEXT_KINDS, type SuggestionCategory } from './constants';
import {
  getToothColorsByFinding,
  rememberCustomFinding,
  rememberCustomTerm,
  rebuildClinicalSearchText,
  searchClinicalText,
} from './queries';
import {
  clinicalPlanItemSchema,
  clinicalPlanStatusSchema,
  clinicalProfileSchema,
  clinicalSearchSchema,
  clinicalToothSchema,
  clinicalVisitSchema,
  convertPlanItemSchema,
} from './schemas';
import { normalizeTextItems } from './text';

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? '');
}

async function patientExists(patientId: string): Promise<boolean> {
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true },
  });
  return !!patient;
}

export async function saveClinicalProfileAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return withAuth(CLINICAL_ROLES, async (actor) => {
    const values = validate(clinicalProfileSchema, {
      patientId: field(formData, 'patientId'),
      conditions: field(formData, 'conditions'),
      allergies: field(formData, 'allergies'),
      medications: field(formData, 'medications'),
      habits: field(formData, 'habits'),
      history: field(formData, 'history'),
      historyNotes: field(formData, 'historyNotes'),
    });
    if (!(await patientExists(values.patientId))) return fail('patientRequired');

    const desired: Record<string, string[]> = {
      condition: normalizeTextItems(values.conditions),
      allergy: normalizeTextItems(values.allergies),
      medication: normalizeTextItems(values.medications),
      habit: normalizeTextItems(values.habits),
      history: normalizeTextItems(values.history),
    };

    const tenantId = await getTenantId();
    await prisma.clinicalProfile.upsert({
      where: { patientId: values.patientId },
      create: {
        tenantId,
        patientId: values.patientId,
        historyNotes: values.historyNotes || null,
      },
      update: { historyNotes: values.historyNotes || null },
    });

    for (const kind of TEXT_KINDS) {
      const texts = desired[kind] ?? [];
      await prisma.clinicalTextItem.deleteMany({
        where: { patientId: values.patientId, kind, text: { notIn: texts } },
      });
      if (texts.length) {
        await prisma.clinicalTextItem.createMany({
          data: texts.map((text) => ({
            tenantId,
            patientId: values.patientId,
            kind,
            text,
            createdBy: actor.id,
          })),
          skipDuplicates: true,
        });
      }
      for (const text of texts) await rememberCustomTerm(kind as SuggestionCategory, text);
    }

    await writeAudit({
      user: actor,
      entity: 'ClinicalProfile',
      entityId: values.patientId,
      action: 'CLINICAL_PROFILE_SAVED',
      new: { ...desired, historyNotes: values.historyNotes },
    });
    await rebuildClinicalSearchText(values.patientId);
    return ok();
  });
}

export async function saveClinicalToothAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAuth<{ id: string }>(CLINICAL_ROLES, async (actor) => {
    const values = validate(clinicalToothSchema, {
      patientId: field(formData, 'patientId'),
      toothNumber: field(formData, 'toothNumber'),
      finding: field(formData, 'finding'),
      note: field(formData, 'note'),
      surfaces: field(formData, 'surfaces'),
    });
    if (!(await patientExists(values.patientId))) return fail('patientRequired');

    const finding = values.finding.trim();
    const color = finding ? await getToothColorsByFinding(finding) : null;
    if (finding && color?.isCustom) await rememberCustomFinding(finding);

    const tooth = await prisma.clinicalTooth.upsert({
      where: {
        tenantId_patientId_toothNumber: {
          tenantId: await getTenantId(),
          patientId: values.patientId,
          toothNumber: values.toothNumber,
        },
      },
      create: {
        tenantId: await getTenantId(),
        patientId: values.patientId,
        toothNumber: values.toothNumber,
        finding: finding || null,
        findingColor: color?.color ?? null,
        findingIsCustom: color?.isCustom ?? false,
        note: values.note || null,
        updatedBy: actor.id,
      },
      update: {
        finding: finding || null,
        findingColor: color?.color ?? null,
        findingIsCustom: color?.isCustom ?? false,
        note: values.note || null,
        updatedBy: actor.id,
      },
    });

    const surfaceEntries = Object.entries(values.surfaces).filter(([, note]) => note.trim());
    await prisma.clinicalSurface.deleteMany({ where: { toothId: tooth.id } });
    if (surfaceEntries.length) {
      await prisma.clinicalSurface.createMany({
        data: surfaceEntries.map(([surface, note]) => ({
          toothId: tooth.id,
          surface,
          note,
          tenantId: tooth.tenantId,
        })),
        skipDuplicates: true,
      });
    }

    await writeAudit({
      user: actor,
      entity: 'ClinicalTooth',
      entityId: tooth.id,
      action: 'CLINICAL_TOOTH_SAVED',
      new: {
        patientId: values.patientId,
        toothNumber: values.toothNumber,
        finding: finding || null,
        note: values.note || null,
        surfaces: surfaceEntries,
      },
    });
    await rebuildClinicalSearchText(values.patientId);
    return ok({ id: tooth.id });
  });
}

export async function createClinicalVisitAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAuth<{ id: string }>(CLINICAL_ROLES, async (actor) => {
    const values = validate(clinicalVisitSchema, {
      patientId: field(formData, 'patientId'),
      visitDate: field(formData, 'visitDate'),
      body: field(formData, 'body'),
      subjective: field(formData, 'subjective'),
      objective: field(formData, 'objective'),
      assessment: field(formData, 'assessment'),
      plan: field(formData, 'plan'),
      diagnosis: field(formData, 'diagnosis'),
      materials: field(formData, 'materials'),
      anesthesia: field(formData, 'anesthesia'),
    });
    if (!(await patientExists(values.patientId))) return fail('patientRequired');

    const visit = await prisma.clinicalVisit.create({
      data: {
        tenantId: await getTenantId(),
        patientId: values.patientId,
        visitDate: new Date(`${values.visitDate}T00:00:00Z`),
        body: values.body || null,
        subjective: values.subjective || null,
        objective: values.objective || null,
        assessment: values.assessment || null,
        plan: values.plan || null,
        diagnosis: values.diagnosis || null,
        materials: values.materials || null,
        anesthesia: values.anesthesia || null,
        createdBy: actor.id,
      },
    });

    if (values.diagnosis) await rememberCustomTerm('diagnosis', values.diagnosis);
    if (values.materials) await rememberCustomTerm('material', values.materials);
    if (values.anesthesia) await rememberCustomTerm('anesthesia', values.anesthesia);

    await writeAudit({
      user: actor,
      entity: 'ClinicalVisit',
      entityId: visit.id,
      action: 'CLINICAL_VISIT_CREATED',
      new: {
        patientId: values.patientId,
        visitDate: values.visitDate,
        body: values.body,
        diagnosis: values.diagnosis,
      },
    });
    await rebuildClinicalSearchText(values.patientId);
    return ok({ id: visit.id });
  });
}

export async function saveClinicalPlanItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return withAuth<{ id: string }>(CLINICAL_ROLES, async (actor) => {
    const rawServiceId = field(formData, 'serviceId');
    let procedureName = field(formData, 'procedureName');
    const service = rawServiceId
      ? await prisma.service.findUnique({
          where: { id: rawServiceId },
          select: { id: true, name: true, currentPrice: true, active: true },
        })
      : null;
    if (rawServiceId && (!service || !service.active)) {
      return fail('validationError', { serviceId: 'invalid' });
    }
    if (!procedureName && service) procedureName = service.name;

    const values = validate(clinicalPlanItemSchema, {
      patientId: field(formData, 'patientId'),
      serviceId: rawServiceId,
      procedureName,
      manualPrice: field(formData, 'manualPrice'),
      toothNumber: field(formData, 'toothNumber'),
      status: field(formData, 'status') || 'PLANNED',
      notes: field(formData, 'notes'),
    });
    if (!(await patientExists(values.patientId))) return fail('patientRequired');

    const serviceId = service?.id ?? null;
    const unitPrice =
      values.manualPrice ?? (service ? (service.currentPrice?.toString() ?? null) : null);

    const item = await prisma.clinicalPlanItem.create({
      data: {
        tenantId: await getTenantId(),
        patientId: values.patientId,
        serviceId,
        procedureName: values.procedureName,
        unitPrice,
        toothNumber: values.toothNumber,
        status: values.status,
        notes: values.notes || null,
        createdBy: actor.id,
      },
    });

    if (!serviceId) await rememberCustomTerm('procedure', values.procedureName);
    await writeAudit({
      user: actor,
      entity: 'ClinicalPlanItem',
      entityId: item.id,
      action: 'CLINICAL_PLAN_ITEM_CREATED',
      new: {
        patientId: values.patientId,
        procedureName: values.procedureName,
        unitPrice,
        toothNumber: values.toothNumber,
        status: values.status,
      },
    });
    await rebuildClinicalSearchText(values.patientId);
    return ok({ id: item.id });
  });
}

export async function updateClinicalPlanStatusAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  return withAuth(CLINICAL_ROLES, async (actor) => {
    const values = validate(clinicalPlanStatusSchema, {
      patientId: field(formData, 'patientId'),
      id: field(formData, 'id'),
      status: field(formData, 'status'),
    });
    const before = await prisma.clinicalPlanItem.findUnique({ where: { id: values.id } });
    if (!before || before.patientId !== values.patientId) return fail('unknownError');

    const updated = await prisma.clinicalPlanItem.update({
      where: { id: values.id },
      data: { status: values.status },
    });
    await writeAudit({
      user: actor,
      entity: 'ClinicalPlanItem',
      entityId: values.id,
      action: 'CLINICAL_PLAN_STATUS_CHANGED',
      old: { status: before.status },
      new: { status: updated.status },
    });
    await rebuildClinicalSearchText(values.patientId);
    return ok();
  });
}

/**
 * Turns a plan item into a normal confirmed sale. Custom items become private
 * Service rows so the existing receipt/printing path needs no special case.
 */
export async function convertClinicalPlanItemAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult<{ saleId: string; receiptNumber: string }>> {
  return withAuth<{ saleId: string; receiptNumber: string }>(CLINICAL_ROLES, async (actor) => {
    const values = validate(convertPlanItemSchema, {
      patientId: field(formData, 'patientId'),
      id: field(formData, 'id'),
      paymentMethod: field(formData, 'paymentMethod'),
    });
    const item = await prisma.clinicalPlanItem.findUnique({ where: { id: values.id } });
    if (!item || item.patientId !== values.patientId) return fail('unknownError');
    if (item.saleId) return fail('alreadyInvoiced');
    if (item.status === 'CANCELLED') return fail('planItemCancelled');

    let serviceId = item.serviceId;
    if (!serviceId) {
      const custom = await prisma.service.create({
        data: {
          tenantId: await getTenantId(),
          name: item.procedureName,
          nameEn: item.procedureName,
          category: 'other',
          currentPrice: item.unitPrice ? toDecimalString(item.unitPrice) : '0.00',
          active: true,
          isPublic: false,
          receiptLabelEn: item.procedureName.slice(0, 120),
        },
      });
      serviceId = custom.id;
    }

    const doctor = await prisma.user.findUnique({
      where: { id: actor.id },
      select: { staffId: true },
    });
    const saleResult = await createSaleForActor(actor, {
      patientId: values.patientId,
      doctorId: doctor?.staffId ?? '',
      paymentMethod: values.paymentMethod,
      walkIn: false,
      lines: [{ serviceId, qty: 1 }],
    });
    if (!saleResult.ok) {
      return fail(saleResult.error ?? 'unknownError', saleResult.fields);
    }
    const sale = saleResult.data;
    if (!sale) return fail('unknownError');

    await prisma.clinicalPlanItem.update({
      where: { id: item.id },
      data: { saleId: sale.id, status: 'COMPLETED' },
    });
    await writeAudit({
      user: actor,
      entity: 'ClinicalPlanItem',
      entityId: item.id,
      action: 'CLINICAL_PLAN_ITEM_INVOICED',
      new: { saleId: sale.id, receiptNumber: sale.receiptNumber },
    });
    await rebuildClinicalSearchText(values.patientId);
    return ok({ saleId: sale.id, receiptNumber: sale.receiptNumber });
  });
}

export async function searchClinicalAction(
  _prev: ActionResult<{ excerpt: string } | null> | null,
  formData: FormData,
): Promise<ActionResult<{ excerpt: string } | null>> {
  return withAuth<{ excerpt: string } | null>(CLINICAL_ROLES, async () => {
    const values = validate(clinicalSearchSchema, {
      patientId: field(formData, 'patientId'),
      query: field(formData, 'query'),
    });
    if (!(await patientExists(values.patientId))) return fail('patientRequired');
    const match = await searchClinicalText(values.patientId, values.query);
    return ok(match);
  });
}
