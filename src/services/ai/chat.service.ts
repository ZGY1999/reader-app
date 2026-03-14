import { VectorService } from './vector.service';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  bookId: string;
  question: string;
  history?: ChatMessage[];
}

export class ChatService {
  private readonly model = 'gpt-3.5-turbo';

  constructor(
    private apiKey: string,
    private baseURL: string,
    private vectorService: VectorService
  ) {}

  async chat(options: ChatOptions): Promise<string> {
    const messages = await this.buildMessages(options);

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages
      })
    });

    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }

    const data = await response.json();
    if (!data.choices?.[0]?.message?.content) {
      throw new Error('API 返回格式异常');
    }
    return data.choices[0].message.content;
  }

  async *chatStream(options: ChatOptions): AsyncGenerator<string> {
    const messages = await this.buildMessages(options);

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true
      })
    });

    if (!response.ok) {
      throw new Error(`API 错误: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('响应体为空');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));

      for (const line of lines) {
        const data = line.replace('data: ', '');
        if (data === '[DONE]') return;

        try {
          const json = JSON.parse(data);
          const content = json.choices[0]?.delta?.content;
          if (content) yield content;
        } catch {}
      }
    }
  }

  private async buildMessages(options: ChatOptions) {
    const results = await this.vectorService.search(options.question, 3);
    const context = results.map(r => r.content).join('\n\n');

    // 使用 system 角色实现 teacher 风格的提示词
    // OpenAI API 不支持自定义角色类型，system 角色用于设置助手行为
    const systemPrompt = `你是一个专业的阅读助手。请基于提供的书籍内容回答用户问题。

重要规则：
1. 只使用提供的书籍内容回答问题
2. 如果内容中没有相关信息，明确告知用户"书籍中没有找到相关内容"
3. 不要编造或推测书籍中没有的信息

书籍内容：
${context}`;

    return [
      { role: 'system' as const, content: systemPrompt },
      ...(options.history || []),
      { role: 'user' as const, content: options.question }
    ];
  }
}
