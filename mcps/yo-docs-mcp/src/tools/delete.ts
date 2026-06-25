import { db, runTransaction } from '../database.ts';

export interface DeleteParams {
  id: string;
}

export interface DeleteResult {
  success: boolean;
  id: string;
  deleted_keywords?: string[];
}

/**
 * 根据 id 删除文档及其关键词关联
 */
export async function deleteDocumentTool(params: DeleteParams): Promise<DeleteResult> {
  const { id } = params;

  // 检查文档是否存在
  const doc = db.prepare('SELECT id, doc_path FROM documents WHERE id = ?').get(id) as
    | { id: string; doc_path: string }
    | undefined;

  if (!doc) {
    return { success: false, id };
  }

  // 找出该文档关联的所有 keyword_id（用于清理孤立关键词）
  const keywordIds = db
    .prepare('SELECT keyword_id FROM doc_keywords WHERE doc_id = ?')
    .all(id) as { keyword_id: number }[];

  runTransaction(() => {
    // 删除关联
    db.prepare('DELETE FROM doc_keywords WHERE doc_id = ?').run(id);
    // 删除文档
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);

    // 清理不再被任何文档引用的关键词
    for (const { keyword_id } of keywordIds) {
      const refCount = db
        .prepare('SELECT COUNT(*) AS cnt FROM doc_keywords WHERE keyword_id = ?')
        .get(keyword_id) as { cnt: number };
      if (refCount.cnt === 0) {
        db.prepare('DELETE FROM keywords WHERE id = ?').run(keyword_id);
      }
    }
  });

  return { success: true, id };
}
