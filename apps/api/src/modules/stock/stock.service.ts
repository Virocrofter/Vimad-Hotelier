/* apps/api/src/modules/stock/stock.service.ts — F6 stock ledger.
 * Current quantity is always derived from the movement ledger. Sales deduct
 * via recipes (BOM); refunds restock. Negative qty is allowed but flagged. */
import { Prisma } from '@prisma/client';
import { prisma } from '../../common/prisma.js';
import { AppError } from '../../common/errors.js';

export async function createItem(
  tenantId: string,
  input: {
    propertyId: string;
    name: string;
    unit?: string;
    parLevel?: number;
    costPerUnit?: number;
  }
) {
  return prisma.stockItem.create({
    data: {
      tenantId,
      propertyId: input.propertyId,
      name: input.name,
      unit: input.unit ?? 'ea',
      parLevel: input.parLevel != null ? new Prisma.Decimal(input.parLevel) : null,
      costPerUnit: input.costPerUnit != null ? new Prisma.Decimal(input.costPerUnit) : null,
    },
  });
}

export async function adjust(
  tenantId: string,
  itemId: string,
  input: {
    kind: 'purchase' | 'adjustment' | 'waste';
    quantityDelta: number;
    unitCost?: number;
    note?: string;
    actorId?: string;
  }
) {
  const item = await prisma.stockItem.findFirst({ where: { id: itemId, tenantId } });
  if (!item) throw new AppError(404, 'Stock item not found', 'NOT_FOUND');
  if (!Number.isFinite(input.quantityDelta) || input.quantityDelta === 0) {
    throw new AppError(400, 'quantityDelta must be a non-zero number', 'VALIDATION_ERROR');
  }
  if (input.kind === 'purchase' && input.quantityDelta < 0) {
    throw new AppError(400, 'Purchases increase stock', 'VALIDATION_ERROR');
  }
  return prisma.stockMovement.create({
    data: {
      tenantId,
      stockItemId: itemId,
      kind: input.kind,
      quantityDelta: new Prisma.Decimal(input.quantityDelta),
      unitCost: input.unitCost != null ? new Prisma.Decimal(input.unitCost) : null,
      note: input.note ?? null,
      actorId: input.actorId ?? null,
      sourceType: 'manual',
    },
  });
}

async function qtyOf(itemId: string) {
  const agg = await prisma.stockMovement.aggregate({
    where: { stockItemId: itemId },
    _sum: { quantityDelta: true },
  });
  return Number(agg._sum.quantityDelta ?? 0);
}

export async function listItems(tenantId: string, propertyId?: string) {
  const items = await prisma.stockItem.findMany({
    where: { tenantId, ...(propertyId ? { propertyId } : {}) },
    orderBy: { name: 'asc' },
    take: 500,
  });
  return Promise.all(
    items.map(async (i) => {
      const onHand = await qtyOf(i.id);
      const par = i.parLevel != null ? Number(i.parLevel) : null;
      return {
        ...i,
        costPerUnit: i.costPerUnit != null ? Number(i.costPerUnit) : null,
        parLevel: par,
        onHand,
        low: par != null && onHand <= par,
      };
    })
  );
}

export async function movements(tenantId: string, itemId: string) {
  const rows = await prisma.stockMovement.findMany({
    where: { tenantId, stockItemId: itemId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return rows.map((m) => ({
    ...m,
    quantityDelta: Number(m.quantityDelta),
    unitCost: m.unitCost != null ? Number(m.unitCost) : null,
  }));
}

/* ─── recipes / BOM ─── */
export async function createRecipe(
  tenantId: string,
  input: {
    propertyId: string;
    name: string;
    productId?: string;
    ingredients: Array<{ stockItemId: string; quantity: number }>;
  }
) {
  if (!input.ingredients?.length) {
    throw new AppError(400, 'A recipe needs at least one ingredient', 'VALIDATION_ERROR');
  }
  if (input.productId) {
    const p = await prisma.upsellProduct.findFirst({
      where: { id: input.productId, tenantId, status: 'active' },
    });
    if (!p) throw new AppError(400, 'Linked product not on the catalog', 'VALIDATION_ERROR');
  }
  const itemIds = input.ingredients.map((i) => i.stockItemId);
  const items = await prisma.stockItem.findMany({ where: { id: { in: itemIds }, tenantId } });
  if (items.length !== new Set(itemIds).size) {
    throw new AppError(400, 'Unknown stock item in ingredients', 'VALIDATION_ERROR');
  }
  return prisma.recipe
    .create({
      data: {
        tenantId,
        propertyId: input.propertyId,
        name: input.name,
        productId: input.productId ?? null,
      },
    })
    .then(async (recipe) => {
      for (const ing of input.ingredients) {
        await prisma.recipeIngredient.create({
          data: {
            recipeId: recipe.id,
            stockItemId: ing.stockItemId,
            quantity: new Prisma.Decimal(ing.quantity),
          },
        });
      }
      return recipe;
    });
}

export async function listRecipes(tenantId: string, propertyId?: string) {
  const recipes = await prisma.recipe.findMany({
    where: { tenantId, ...(propertyId ? { propertyId } : {}) },
    orderBy: { name: 'asc' },
    take: 300,
  });
  return Promise.all(
    recipes.map(async (r) => {
      const ingredients = await prisma.recipeIngredient.findMany({ where: { recipeId: r.id } });
      return {
        ...r,
        ingredients: ingredients.map((g) => ({ ...g, quantity: Number(g.quantity) })),
      };
    })
  );
}

/* ─── sales deduction / restock (hooked from the till close and F3) ─── */
export async function applySale(
  tenantId: string,
  sourceType: 'till_check' | 'fnb_order',
  sourceId: string,
  lines: Array<{ productId?: string | null; quantity: number }>,
  actorId?: string
) {
  let movements = 0;
  for (const line of lines) {
    if (!line.productId) continue;
    const recipe = await prisma.recipe.findFirst({
      where: { tenantId, productId: line.productId },
    });
    if (!recipe) continue;
    const ingredients = await prisma.recipeIngredient.findMany({ where: { recipeId: recipe.id } });
    for (const ing of ingredients) {
      await prisma.stockMovement.create({
        data: {
          tenantId,
          stockItemId: ing.stockItemId,
          kind: 'usage',
          quantityDelta: new Prisma.Decimal(-Math.abs(Number(ing.quantity)) * line.quantity),
          sourceType,
          sourceId,
          actorId: actorId ?? null,
          note: `Recipe: ${recipe.name}`,
        },
      });
      movements += 1;
    }
  }
  return { movements };
}

export async function applyRestock(
  tenantId: string,
  sourceType: 'till_check' | 'fnb_order',
  sourceId: string,
  lines: Array<{ productId?: string | null; quantity: number }>,
  actorId?: string
) {
  let movements = 0;
  for (const line of lines) {
    if (!line.productId) continue;
    const recipe = await prisma.recipe.findFirst({
      where: { tenantId, productId: line.productId },
    });
    if (!recipe) continue;
    const ingredients = await prisma.recipeIngredient.findMany({ where: { recipeId: recipe.id } });
    for (const ing of ingredients) {
      await prisma.stockMovement.create({
        data: {
          tenantId,
          stockItemId: ing.stockItemId,
          kind: 'restock',
          quantityDelta: new Prisma.Decimal(Math.abs(Number(ing.quantity)) * line.quantity),
          sourceType,
          sourceId,
          actorId: actorId ?? null,
          note: `Refund restock: ${recipe.name}`,
        },
      });
      movements += 1;
    }
  }
  return { movements };
}

/* The F9 feed: item performance from real sales (till items + F3 orders). */
export async function itemPerformance(tenantId: string, propertyId?: string) {
  const since = new Date(Date.now() - 30 * 86400_000);
  const tillChecks = await prisma.tillCheck.findMany({
    where: {
      tenantId,
      status: 'closed',
      closedAt: { gte: since },
      ...(propertyId ? { propertyId } : {}),
    },
    select: { id: true },
  });
  const tillItems = await prisma.tillCheckItem.findMany({
    where: { tenantId, checkId: { in: tillChecks.map((c) => c.id) }, reversed: false },
    select: { productId: true, name: true, quantity: true, unitPrice: true, comped: true },
  });
  const paidOrders = await prisma.fnBOrder.findMany({
    where: {
      tenantId,
      status: { in: ['paid', 'preparing', 'served'] },
      createdAt: { gte: since },
      ...(propertyId ? { propertyId } : {}),
    },
    select: { items: true },
  });
  const agg = new Map<string, { name: string; qty: number; revenue: number; comps: number }>();
  const bump = (key: string, name: string, qty: number, revenue: number, comps: number) => {
    const cur = agg.get(key) ?? { name, qty: 0, revenue: 0, comps: 0 };
    cur.qty += qty;
    cur.revenue += revenue;
    cur.comps += comps;
    agg.set(key, cur);
  };
  for (const i of tillItems) {
    bump(
      i.productId ?? i.name,
      i.name,
      i.quantity,
      Number(i.unitPrice) * i.quantity,
      i.comped ? 1 : 0
    );
  }
  for (const o of paidOrders) {
    for (const l of o.items as Array<{
      productId: string;
      name: string;
      quantity: number;
      lineTotal: number;
    }>) {
      bump(l.productId, l.name, l.quantity, l.lineTotal, 0);
    }
  }
  return [...agg.entries()]
    .map(([productId, v]) => ({ productId, ...v, revenue: Math.round(v.revenue * 100) / 100 }))
    .sort((a, b) => b.revenue - a.revenue);
}
