import { CallModel } from './CallModel.ts';

export * from './types.ts';
export { buildHeaders, getModelConfig, imageBlock } from './utils.ts';
export { CallModel } from './CallModel.ts';

/** 默认实例，供所有原有调用方直接使用。 */
export const callModel = new CallModel();
