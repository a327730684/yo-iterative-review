import { Jieba } from '@node-rs/jieba';
import { dict } from '@node-rs/jieba/dict.js';

// 用默认字典创建实例（单例）
const jieba = Jieba.withDict(dict);

// 停用词表
const stopwords = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人',
  '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去',
  '你', '会', '着', '没有', '看', '好', '自己', '这', '他', '她',
  '它', '们', '那', '些',
]);

/**
 * 对文本进行分词处理
 * 流程：jieba 分词 → 转小写 → 过滤停用词和单字（length <= 1）→ 去重
 */
export function tokenize(text: string): string[] {
  if (!text || text.trim() === '') return [];

  const words = jieba.cut(text, true);

  const keywords = words
    .map(w => w.toLowerCase().trim())
    .filter(w => w.length > 1 && !stopwords.has(w));

  // 去重
  return [...new Set(keywords)];
}
