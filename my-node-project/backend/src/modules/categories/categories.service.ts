import { query } from '../../db/pool.js';
import type { CreateCategory, UpdateCategory, CategoryResponse } from '../common/schemas.js';

export class CategoriesService {
  async findAll(): Promise<CategoryResponse[]> {
    const result = await query<CategoryResponse>(`
      SELECT id, code, name_vi, name_en, icon, color, sort_order, is_active, created_at, updated_at
      FROM categories
      WHERE is_active = true
      ORDER BY sort_order, name_vi
    `);
    return result.rows;
  }

  async findById(id: number): Promise<CategoryResponse | null> {
    const result = await query<CategoryResponse>(`
      SELECT id, code, name_vi, name_en, icon, color, sort_order, is_active, created_at, updated_at
      FROM categories WHERE id = $1
    `, [id]);
    return result.rows[0] ?? null;
  }

  async findByCode(code: string): Promise<CategoryResponse | null> {
    const result = await query<CategoryResponse>(`
      SELECT id, code, name_vi, name_en, icon, color, sort_order, is_active, created_at, updated_at
      FROM categories WHERE code = $1
    `, [code]);
    return result.rows[0] ?? null;
  }

  async create(data: CreateCategory): Promise<CategoryResponse> {
    const result = await query<CategoryResponse>(`
      INSERT INTO categories (code, name_vi, name_en, icon, color, sort_order, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, code, name_vi, name_en, icon, color, sort_order, is_active, created_at, updated_at
    `, [data.code, data.name_vi, data.name_en, data.icon, data.color, data.sort_order, data.is_active]);
    return result.rows[0];
  }

  async update(id: number, data: UpdateCategory): Promise<CategoryResponse | null> {
    // Whitelist updatable columns — never interpolate raw body keys into SQL
    const fieldMap: Record<string, string> = {
      code: 'code',
      name_vi: 'name_vi',
      name_en: 'name_en',
      icon: 'icon',
      color: 'color',
      sort_order: 'sort_order',
      is_active: 'is_active',
    };

    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && key in fieldMap) {
        fields.push(`${fieldMap[key]} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const result = await query<CategoryResponse>(`
      UPDATE categories SET ${fields.join(', ')}, updated_at = now()
      WHERE id = $${paramIndex}
      RETURNING id, code, name_vi, name_en, icon, color, sort_order, is_active, created_at, updated_at
    `, values);
    return result.rows[0] ?? null;
  }

  async delete(id: number): Promise<boolean> {
    const result = await query(`DELETE FROM categories WHERE id = $1`, [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async getWithPlaceCounts(): Promise<Array<CategoryResponse & { place_count: number }>> {
    const result = await query<CategoryResponse & { place_count: number }>(`
      SELECT c.id, c.code, c.name_vi, c.name_en, c.icon, c.color, c.sort_order, c.is_active, c.created_at, c.updated_at,
             COUNT(p.id)::int as place_count
      FROM categories c
      LEFT JOIN places p ON p.category_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.sort_order, c.name_vi
    `);
    return result.rows;
  }
}

export const categoriesService = new CategoriesService();