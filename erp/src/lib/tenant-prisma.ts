import { Prisma } from '@prisma/client';
import { basePrisma } from '@/lib/prisma-base';
import { getExplicitTenantId } from '@/lib/tenant-scope';

/**
 * Tenant scoping for Prisma. The model list comes from the generated schema's
 * DMMF: every model with a `tenantId` field is tenant-owned, and every other
 * model (notably `Tenant`) is left alone.
 */

type Args = Record<string, unknown>;
type DataMode = 'top' | 'create' | 'update';

const tenantOwnedModels = new Set(
  Prisma.dmmf.datamodel.models
    .filter((model) => model.fields.some((field) => field.name === 'tenantId'))
    .map((model) => model.name),
);

export const TENANT_OWNED_MODELS = [...tenantOwnedModels].sort();

const relations = new Map<string, Map<string, string>>();
for (const model of Prisma.dmmf.datamodel.models) {
  relations.set(
    model.name,
    new Map(
      model.fields
        .filter((field) => field.kind === 'object' && field.relationName)
        .map((field) => [field.name, field.type] as const),
    ),
  );
}

const LOGICAL_KEYS = new Set(['AND', 'OR', 'NOT']);
const RAW_MODEL_OPERATIONS = new Set(['findRaw', 'aggregateRaw', 'runCommandRaw']);

export class TenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantMismatchError';
  }
}

function isPlainObject(value: unknown): value is Args {
  if (value === null || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function mismatch(context: string, tenantId: string, found: unknown): TenantMismatchError {
  return new TenantMismatchError(
    `Tenant mismatch in ${context}: expected "${tenantId}", got ${JSON.stringify(found)}`,
  );
}

/** Accept only an unambiguous equality constraint on tenantId. */
function assertTenantId(value: unknown, tenantId: string, context: string): void {
  if (typeof value === 'string') {
    if (value !== tenantId) throw mismatch(context, tenantId, value);
    return;
  }
  if (isPlainObject(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === 'equals') {
      assertTenantId(value.equals, tenantId, `${context}.equals`);
      return;
    }
    if (keys.length === 1 && keys[0] === 'in' && Array.isArray(value.in) && value.in.length === 1) {
      assertTenantId(value.in[0], tenantId, `${context}.in[0]`);
      return;
    }
  }
  throw mismatch(context, tenantId, value);
}

function hasTenantCompoundKey(value: Args): boolean {
  return Object.entries(value).some(
    ([key, nested]) =>
      key.startsWith('tenantId_') && isPlainObject(nested) && 'tenantId' in nested,
  );
}

function validateTenantRelation(value: unknown, tenantId: string, context: string): unknown {
  if (Array.isArray(value)) return value.map((item) => validateTenantRelation(item, tenantId, context));
  if (!isPlainObject(value)) return value;
  const out: Args = { ...value };
  if ('id' in out) assertTenantId(out.id, tenantId, `${context}.id`);
  if (isPlainObject(out.connect) && 'id' in out.connect) {
    assertTenantId(out.connect.id, tenantId, `${context}.connect.id`);
  }
  return out;
}

/** Scope a `where` clause, including relation filters and compound selectors. */
function scopeWhere(model: string, value: unknown, tenantId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => scopeWhere(model, item, tenantId));
  if (!isPlainObject(value)) return value;

  const out: Args = {};
  for (const [key, nested] of Object.entries(value)) {
    const context = `${model}.where.${key}`;
    if (key === 'tenantId') {
      assertTenantId(nested, tenantId, context);
      out[key] = nested;
      continue;
    }
    if (key.startsWith('tenantId_') && isPlainObject(nested) && 'tenantId' in nested) {
      assertTenantId(nested.tenantId, tenantId, `${context}.tenantId`);
      out[key] = nested;
      continue;
    }
    if (LOGICAL_KEYS.has(key)) {
      out[key] = scopeWhere(model, nested, tenantId);
      continue;
    }
    const target = relations.get(model)?.get(key);
    if (target === 'Tenant') {
      out[key] = validateTenantRelation(nested, tenantId, context);
      continue;
    }
    if (target && tenantOwnedModels.has(target)) {
      out[key] = scopeWhere(target, nested, tenantId);
      continue;
    }
    out[key] = nested;
  }

  if (tenantOwnedModels.has(model) && !('tenantId' in out) && !hasTenantCompoundKey(out)) {
    out.tenantId = tenantId;
  }
  return out;
}

/** Scope nested relation writes (`create`, `connect`, `updateMany`, …). */
function scopeRelationInput(
  model: string,
  value: unknown,
  tenantId: string,
  mode: DataMode = 'create',
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => scopeRelationInput(model, item, tenantId, mode));
  }
  if (!isPlainObject(value)) return value;

  const out: Args = {};
  for (const [key, nested] of Object.entries(value)) {
    switch (key) {
      case 'create':
      case 'createMany':
      case 'createManyAndReturn':
        out[key] = scopeData(model, nested, tenantId, 'create');
        break;
      case 'connect':
      case 'disconnect':
      case 'set':
      case 'delete':
        out[key] = scopeWhere(model, nested, tenantId);
        break;
      case 'connectOrCreate':
      case 'upsert':
        if (isPlainObject(nested)) {
          out[key] = {
            ...nested,
            ...('where' in nested ? { where: scopeWhere(model, nested.where, tenantId) } : {}),
            ...('create' in nested
              ? { create: scopeData(model, nested.create, tenantId, 'create') }
              : {}),
            ...('update' in nested
              ? { update: scopeData(model, nested.update, tenantId, 'update') }
              : {}),
          };
        } else {
          out[key] = nested;
        }
        break;
      case 'update':
        if (Array.isArray(nested)) {
          out[key] = nested.map((item) => {
            if (!isPlainObject(item) || !('where' in item)) {
              return scopeData(model, item, tenantId, 'update');
            }
            return {
              ...item,
              where: scopeWhere(model, item.where, tenantId),
              data: scopeData(model, item.data, tenantId, 'update'),
            };
          });
        } else {
          out[key] = scopeData(model, nested, tenantId, 'update');
        }
        break;
      case 'updateMany':
      case 'updateManyAndReturn':
        if (Array.isArray(nested)) {
          out[key] = nested.map((item) => {
            if (!isPlainObject(item)) return item;
            return {
              ...item,
              where: scopeWhere(model, item.where, tenantId),
              data: scopeData(model, item.data, tenantId, 'update'),
            };
          });
        } else if (isPlainObject(nested)) {
          out[key] = {
            ...nested,
            where: scopeWhere(model, nested.where, tenantId),
            data: scopeData(model, nested.data, tenantId, 'update'),
          };
        } else {
          out[key] = nested;
        }
        break;
      case 'deleteMany':
        if (Array.isArray(nested)) {
          out[key] = nested.map((item) => scopeWhere(model, item, tenantId));
        } else if (isPlainObject(nested) && 'where' in nested) {
          out[key] = { ...nested, where: scopeWhere(model, nested.where, tenantId) };
        } else {
          out[key] = scopeWhere(model, nested, tenantId);
        }
        break;
      default:
        out[key] = nested;
    }
  }
  return out;
}

/** Scope `data` for create/update/upsert, including nested writes. */
function scopeData(model: string, value: unknown, tenantId: string, mode: DataMode = 'top'): unknown {
  if (Array.isArray(value)) return value.map((item) => scopeData(model, item, tenantId, mode));
  if (!isPlainObject(value)) return value;

  const out: Args = {};
  for (const [key, nested] of Object.entries(value)) {
    const context = `${model}.data.${key}`;
    if (key === 'tenantId') {
      assertTenantId(nested, tenantId, context);
      out[key] = nested;
      continue;
    }
    const target = relations.get(model)?.get(key);
    if (target === 'Tenant') {
      out[key] = validateTenantRelation(nested, tenantId, context);
      continue;
    }
    if (target && tenantOwnedModels.has(target)) {
      out[key] = scopeRelationInput(target, nested, tenantId);
      continue;
    }
    out[key] = nested;
  }

  if (tenantOwnedModels.has(model) && mode !== 'update' && !('tenantId' in out)) {
    const usesRelations = Object.keys(value).some((key) => relations.get(model)?.has(key));
    if (mode === 'create' && usesRelations) {
      // Nested checked create inputs use the relation, not the scalar FK.
      out.tenant = { connect: { id: tenantId } };
    } else {
      out.tenantId = tenantId;
    }
  }
  return out;
}

/** Scope relation filters inside `select`, `include` and `_count`. */
function scopeSelection(model: string, value: unknown, tenantId: string): unknown {
  if (Array.isArray(value)) return value.map((item) => scopeSelection(model, item, tenantId));
  if (!isPlainObject(value)) return value;

  const out: Args = {};
  for (const [key, nested] of Object.entries(value)) {
    const target = relations.get(model)?.get(key);
    if (target && tenantOwnedModels.has(target) && isPlainObject(nested)) {
      const relation: Args = { ...nested };
      if ('where' in relation) relation.where = scopeWhere(target, relation.where, tenantId);
      if ('select' in relation) relation.select = scopeSelection(target, relation.select, tenantId);
      if ('include' in relation) relation.include = scopeSelection(target, relation.include, tenantId);
      out[key] = relation;
    } else if (isPlainObject(nested) || Array.isArray(nested)) {
      out[key] = scopeSelection(model, nested, tenantId);
    } else {
      out[key] = nested;
    }
  }
  return out;
}

function scopeArgs(model: string, operation: string, value: unknown, tenantId: string): unknown {
  if (!isPlainObject(value)) return value;

  const out: Args = {};
  for (const [key, nested] of Object.entries(value)) {
    switch (key) {
      case 'where':
        out[key] = scopeWhere(model, nested, tenantId);
        break;
      case 'data':
        out[key] = scopeData(
          model,
          nested,
          tenantId,
          operation === 'create' || operation === 'createMany' || operation === 'createManyAndReturn'
            ? 'create'
            : operation.startsWith('update')
              ? 'update'
              : 'top',
        );
        break;
      case 'create':
        out[key] = scopeData(model, nested, tenantId, 'create');
        break;
      case 'update':
        out[key] = scopeData(model, nested, tenantId, 'update');
        break;
      case 'select':
      case 'include':
        out[key] = scopeSelection(model, nested, tenantId);
        break;
      default:
        out[key] = nested;
    }
  }
  return out;
}

async function resolveTenantId(): Promise<string> {
  const explicit = getExplicitTenantId();
  if (explicit) return explicit;
  // Lazy import avoids a cycle: tenant-context resolves the default tenant
  // through this client, while this module needs tenant-context for sessions.
  const { getTenantId } = await import('@/lib/tenant-context');
  return getTenantId();
}

/** Build the scoped client used by the application. */
export function createTenantPrisma() {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (!model || !tenantOwnedModels.has(model) || RAW_MODEL_OPERATIONS.has(operation)) {
            return query(args);
          }
          const tenantId = await resolveTenantId();
          return query(scopeArgs(model, operation, args, tenantId) as typeof args);
        },
      },
    },
  });
}

export function isTenantOwnedModel(model: string): boolean {
  return tenantOwnedModels.has(model);
}
