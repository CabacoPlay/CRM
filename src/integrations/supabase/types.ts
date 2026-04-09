export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      auth_tokens: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          token: string
          used: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          token: string
          used?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          token?: string
          used?: boolean
        }
        Relationships: []
      }
      agenda_settings: {
        Row: {
          empresa_id: string
          timezone: string
          schedule: Json
          slot_interval_minutes: number
          min_advance_minutes: number
          max_advance_days: number
          reminder_hours: number
          confirm_template: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          empresa_id: string
          timezone?: string
          schedule?: Json
          slot_interval_minutes?: number
          min_advance_minutes?: number
          max_advance_days?: number
          reminder_hours?: number
          confirm_template?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          empresa_id?: string
          timezone?: string
          schedule?: Json
          slot_interval_minutes?: number
          min_advance_minutes?: number
          max_advance_days?: number
          reminder_hours?: number
          confirm_template?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agenda_settings_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      agendamentos: {
        Row: {
          contato_cliente: string | null
          created_at: string
          data_hora: string
          empresa_id: string
          id: string
          nome_cliente: string
          origem: string
          servico: string
          status: string
          updated_at: string
        }
        Insert: {
          contato_cliente?: string | null
          created_at?: string
          data_hora: string
          empresa_id: string
          id?: string
          nome_cliente: string
          origem: string
          servico: string
          status: string
          updated_at?: string
        }
        Update: {
          contato_cliente?: string | null
          created_at?: string
          data_hora?: string
          empresa_id?: string
          id?: string
          nome_cliente?: string
          origem?: string
          servico?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamentos: {
        Row: {
          contato_id: string | null
          created_at: string
          descricao: string | null
          empresa_id: string
          id: string
          logo_url: string | null
          pdf_url: string | null
          status: string
          titulo: string
          total: number
          updated_at: string
        }
        Insert: {
          contato_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id: string
          id?: string
          logo_url?: string | null
          pdf_url?: string | null
          status?: string
          titulo: string
          total?: number
          updated_at?: string
        }
        Update: {
          contato_id?: string | null
          created_at?: string
          descricao?: string | null
          empresa_id?: string
          id?: string
          logo_url?: string | null
          pdf_url?: string | null
          status?: string
          titulo?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orcamentos_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_settings: {
        Row: {
          created_at: string
          email: string | null
          empresa_id: string
          instagram: string | null
          logo_url: string | null
          pix_banco: string | null
          pix_chave: string | null
          pix_nome: string | null
          updated_at: string
          validade_dias: number
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          empresa_id: string
          instagram?: string | null
          logo_url?: string | null
          pix_banco?: string | null
          pix_chave?: string | null
          pix_nome?: string | null
          updated_at?: string
          validade_dias?: number
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          empresa_id?: string
          instagram?: string | null
          logo_url?: string | null
          pix_banco?: string | null
          pix_chave?: string | null
          pix_nome?: string | null
          updated_at?: string
          validade_dias?: number
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_settings_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: true
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      orcamento_itens: {
        Row: {
          catalog_item_id: string | null
          created_at: string
          descricao: string | null
          id: string
          nome: string
          orcamento_id: string
          position: number
          quantidade: number
          tipo: string
          total: number
          valor_unitario: number
        }
        Insert: {
          catalog_item_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome: string
          orcamento_id: string
          position?: number
          quantidade?: number
          tipo: string
          total?: number
          valor_unitario?: number
        }
        Update: {
          catalog_item_id?: string | null
          created_at?: string
          descricao?: string | null
          id?: string
          nome?: string
          orcamento_id?: string
          position?: number
          quantidade?: number
          tipo?: string
          total?: number
          valor_unitario?: number
        }
        Relationships: [
          {
            foreignKeyName: "orcamento_itens_catalog_item_id_fkey"
            columns: ["catalog_item_id"]
            isOneToOne: false
            referencedRelation: "catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orcamento_itens_orcamento_id_fkey"
            columns: ["orcamento_id"]
            isOneToOne: false
            referencedRelation: "orcamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      branding_configs: {
        Row: {
          created_at: string
          empresa_id: string | null
          id: string
          logo_url: string | null
          logo_url_dark: string | null
          logo_url_light: string | null
          primary_color: string
          secondary_color: string
          system_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          logo_url?: string | null
          logo_url_dark?: string | null
          logo_url_light?: string | null
          primary_color?: string
          secondary_color?: string
          system_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: string | null
          id?: string
          logo_url?: string | null
          logo_url_dark?: string | null
          logo_url_light?: string | null
          primary_color?: string
          secondary_color?: string
          system_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_items: {
        Row: {
          ativo: boolean
          categoria_id: string
          created_at: string
          descricao: string | null
          empresa_id: string | null
          id: string
          image_url: string | null
          nome: string
          tipo: Database["public"]["Enums"]["catalog_item_type"]
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          categoria_id: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          image_url?: string | null
          nome: string
          tipo: Database["public"]["Enums"]["catalog_item_type"]
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          categoria_id?: string
          created_at?: string
          descricao?: string | null
          empresa_id?: string | null
          id?: string
          image_url?: string | null
          nome?: string
          tipo?: Database["public"]["Enums"]["catalog_item_type"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_items_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_items_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias: {
        Row: {
          cor: string
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      conexoes: {
        Row: {
          api_url: string
          apikey: string | null
          created_at: string
          empresa_id: string | null
          globalkey: string | null
          id: string
          id_ia: string | null
          last_status_checked_at: string | null
          last_status_error: string | null
          last_status_raw: string | null
          nome_api: string
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          api_url: string
          apikey?: string | null
          created_at?: string
          empresa_id?: string | null
          globalkey?: string | null
          id?: string
          id_ia?: string | null
          last_status_checked_at?: string | null
          last_status_error?: string | null
          last_status_raw?: string | null
          nome_api: string
          status: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          api_url?: string
          apikey?: string | null
          created_at?: string
          empresa_id?: string | null
          globalkey?: string | null
          id?: string
          id_ia?: string | null
          last_status_checked_at?: string | null
          last_status_error?: string | null
          last_status_raw?: string | null
          nome_api?: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conexoes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conexoes_id_ia_fkey"
            columns: ["id_ia"]
            isOneToOne: false
            referencedRelation: "ias"
            referencedColumns: ["id"]
          },
        ]
      }
      contatos: {
        Row: {
          atendimento_ia: string | null
          atendimento_mode: string
          assigned_user_id: string | null
          contato: string
          conexao_id: string | null
          created_at: string
          empresa_id: string | null
          fase_id: string | null
          id: string
          nome: string
          oculta: boolean
          observacoes_ia: string | null
          profile_img_url: string | null
          profile_img_fetched_at: string | null
          resumo: string | null
          updated_at: string
        }
        Insert: {
          atendimento_ia?: string | null
          atendimento_mode?: string
          assigned_user_id?: string | null
          contato: string
          conexao_id?: string | null
          created_at?: string
          empresa_id?: string | null
          fase_id?: string | null
          id?: string
          nome: string
          oculta?: boolean
          observacoes_ia?: string | null
          profile_img_url?: string | null
          profile_img_fetched_at?: string | null
          resumo?: string | null
          updated_at?: string
        }
        Update: {
          atendimento_ia?: string | null
          atendimento_mode?: string
          assigned_user_id?: string | null
          contato?: string
          conexao_id?: string | null
          created_at?: string
          empresa_id?: string | null
          fase_id?: string | null
          id?: string
          nome?: string
          oculta?: boolean
          observacoes_ia?: string | null
          profile_img_url?: string | null
          profile_img_fetched_at?: string | null
          resumo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contatos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contatos_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "fases"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          conexao_id: string | null
          contato_id: string
          conteudo: string
          created_at: string
          direcao: string
          duration_ms: number | null
          empresa_id: string | null
          external_id: string | null
          file_name: string | null
          id: string
          media_url: string | null
          mimetype: string | null
          reply_to_external_id: string | null
          reply_to_message_id: string | null
          reply_to_preview: string | null
          sender_name: string | null
          sender_user_id: string | null
          status: string
          tipo: string
          updated_at: string | null
        }
        Insert: {
          conexao_id?: string | null
          contato_id: string
          conteudo: string
          created_at?: string
          direcao: string
          duration_ms?: number | null
          empresa_id?: string | null
          external_id?: string | null
          file_name?: string | null
          id?: string
          media_url?: string | null
          mimetype?: string | null
          reply_to_external_id?: string | null
          reply_to_message_id?: string | null
          reply_to_preview?: string | null
          sender_name?: string | null
          sender_user_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string | null
        }
        Update: {
          conexao_id?: string | null
          contato_id?: string
          conteudo?: string
          created_at?: string
          direcao?: string
          duration_ms?: number | null
          empresa_id?: string | null
          external_id?: string | null
          file_name?: string | null
          id?: string
          media_url?: string | null
          mimetype?: string | null
          reply_to_external_id?: string | null
          reply_to_message_id?: string | null
          reply_to_preview?: string | null
          sender_name?: string | null
          sender_user_id?: string | null
          status?: string
          tipo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conexao_id_fkey"
            columns: ["conexao_id"]
            isOneToOne: false
            referencedRelation: "conexoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "mensagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_sender_user_id_fkey"
            columns: ["sender_user_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativa: boolean
          created_at: string
          id: string
          logo_url: string | null
          nome: string
          responsavel: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          nome: string
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          nome?: string
          responsavel?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          created_at: string
          ia_id: string
          id: string
          pergunta: string
          resposta: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ia_id: string
          id?: string
          pergunta: string
          resposta: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ia_id?: string
          id?: string
          pergunta?: string
          resposta?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faqs_ia_id_fkey"
            columns: ["ia_id"]
            isOneToOne: false
            referencedRelation: "ias"
            referencedColumns: ["id"]
          },
        ]
      }
      fases: {
        Row: {
          cor: string
          created_at: string
          empresa_id: string | null
          id: string
          nome: string
          position: number
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome: string
          position?: number
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fases_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ias: {
        Row: {
          ativa: boolean
          created_at: string
          empresa_id: string | null
          id: string
          msg_reativacao: string | null
          nome: string
          openia_key: string | null
          personalidade: Database["public"]["Enums"]["ia_personalidade"]
          profile_img_url: string | null
          prompt: string
          sexo: string | null
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          msg_reativacao?: string | null
          nome: string
          openia_key?: string | null
          personalidade?: Database["public"]["Enums"]["ia_personalidade"]
          profile_img_url?: string | null
          prompt: string
          sexo?: string | null
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          empresa_id?: string | null
          id?: string
          msg_reativacao?: string | null
          nome?: string
          openia_key?: string | null
          personalidade?: Database["public"]["Enums"]["ia_personalidade"]
          profile_img_url?: string | null
          prompt?: string
          sexo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          contato_id: string
          created_at: string
          id: string
          texto: string
          updated_at: string
        }
        Insert: {
          contato_id: string
          created_at?: string
          id?: string
          texto: string
          updated_at?: string
        }
        Update: {
          contato_id?: string
          created_at?: string
          id?: string
          texto?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          empresa_id: string | null
          id: string
          nome: string
          papel: Database["public"]["Enums"]["usuario_papel"]
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          empresa_id?: string | null
          id?: string
          nome: string
          papel?: Database["public"]["Enums"]["usuario_papel"]
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          empresa_id?: string | null
          id?: string
          nome?: string
          papel?: Database["public"]["Enums"]["usuario_papel"]
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      catalog_item_type: "Produto" | "Serviço"
      ia_personalidade: "Formal" | "Informal" | "Casual"
      usuario_papel: "admin" | "cliente"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      catalog_item_type: ["Produto", "Serviço"],
      ia_personalidade: ["Formal", "Informal", "Casual"],
      usuario_papel: ["admin", "cliente"],
    },
  },
} as const
