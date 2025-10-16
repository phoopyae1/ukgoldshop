import Dexie, { Table } from 'dexie';
import { GoldItem, PawnRecord } from './types';

class GoldShopDatabase extends Dexie {
  goldItems!: Table<GoldItem, string>;
  pawnRecords!: Table<PawnRecord, string>;

  constructor() {
    super('ukgoldshop');
    this.version(1).stores({
      goldItems: 'id, uploadedAt',
      pawnRecords: 'id, date, createdAt',
    });
  }
}

export const db = new GoldShopDatabase();
