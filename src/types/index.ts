export interface LLMProvider {
  id: string;
  name: string;
  is_configured: boolean;
  models: { id: string; name: string }[];
}
