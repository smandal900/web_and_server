// Builds the WHERE clause for "which assets": shared by the timeline and by search, so the same rules
// (trash, favorites, visibility, people, tags, albums, stacks) are written once.
import { requireElevated } from './auth.js';
import { VISIBILITIES, placeholders, toIso } from './util.js';

export class AssetFilter {
  where = [];
  params = [];

  add(sql, ...params) {
    this.where.push(sql);
    this.params.push(...params);
    return this;
  }

  get clause() {
    return this.where.join(' AND ');
  }

  trashed(on) {
    return this.add(on ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL');
  }

  /** @param value true / false / 'true' / 'false'; anything else leaves the filter alone */
  favorite(value) {
    if (value === true || value === 'true') this.add('is_favorite = 1');
    if (value === false || value === 'false') this.add('is_favorite = 0');
    return this;
  }

  /** column >= from and column <= to; a bound that is missing or not a date is ignored. */
  between(column, from, to) {
    const low = toIso(from);
    const high = toIso(to);
    if (low) this.add(`${column} >= ?`, low);
    if (high) this.add(`${column} <= ?`, high);
    return this;
  }

  /** An asked-for visibility (the locked folder needs an unlocked session), or `fallbackSql` when none was asked for. */
  visibility(req, value, fallbackSql) {
    if (VISIBILITIES.has(value)) {
      if (value === 'locked') requireElevated(req);
      return this.add('visibility = ?', value);
    }
    return fallbackSql ? this.add(fallbackSql) : this;
  }

  /** Assets that have at least one of the given rows in a link table (person_assets / tag_assets / album_assets). */
  linked(table, column, ids) {
    if (ids.length) this.add(`EXISTS (SELECT 1 FROM ${table} l WHERE l.asset_id = assets.id AND l.${column} IN (${placeholders(ids)}))`, ...ids);
    return this;
  }

  people(ids) {
    return this.linked('person_assets', 'person_id', ids);
  }

  tags(ids) {
    return this.linked('tag_assets', 'tag_id', ids);
  }

  albums(ids) {
    return this.linked('album_assets', 'album_id', ids);
  }

  /** Show only the cover of every stack. */
  collapseStacks() {
    return this.add('(stack_id IS NULL OR id = (SELECT primary_asset_id FROM stacks WHERE id = assets.stack_id))');
  }
}
