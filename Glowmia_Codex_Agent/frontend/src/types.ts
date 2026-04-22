export type Language = "en" | "ar";
export type ToolType = "llm" | "recommend" | "edit" | "styling";
export type IntentType = "recommend" | "styling" | "edit" | "chat";

export interface Dress {
  id: string;
  name: string;
  color?: string | null;
  occasion?: string | null;
  style?: string | null;
  sleeve_type?: string | null;
  length?: string | null;
  fabric?: string | null;
  fit?: string | null;
  description?: string | null;
  image_url?: string | null;
  front_view_url?: string | null;
  back_view_url?: string | null;
  side_view_url?: string | null;
  cover_image_url?: string | null;
}

export interface ChatApiResponse {
  session_id: string;
  tool: ToolType;
  intent: IntentType;
  language: Language;
  message: string;
  dresses: Dress[];
  edited_image_url?: string | null;
  selected_dress_id?: string | null;
}

export interface MessageBubble {
  id: string;
  role: "user" | "assistant";
  content: string;
  tool?: ToolType;
  intent?: IntentType;
  dresses?: Dress[];
  editedImageUrl?: string | null;
}
