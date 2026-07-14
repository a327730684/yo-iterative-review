export interface ModelConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ImageBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export type ContentBlock = TextBlock | ImageBlock;

export interface Message {
  role: string;
  content: string | ContentBlock[];
}

export interface JsonSchemaFormat {
  type: 'json_schema';
  schema: Record<string, unknown>;
}

export interface CallModelOptions {
  messages: Message[];
  maxTokens?: number;
  config?: ModelConfig;
  signal?: AbortSignal;
  responseFormat?: JsonSchemaFormat;
}

export interface CallModelWithImageOptions {
  prompt: string;
  imageBuffer: Buffer | Uint8Array;
  mediaType: string;
  maxTokens?: number;
  config?: ModelConfig;
  signal?: AbortSignal;
}
