export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type AppRole = 'super_admin' | 'admin' | 'manager' | 'seller'
export type CustomFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select' | 'multi_select' | 'url' | 'phone' | 'email'

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: { id: string; name: string; slug: string; logo_url: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; name: string; slug: string; logo_url?: string | null; created_at?: string; updated_at?: string }
        Update: { name?: string; slug?: string; logo_url?: string | null; updated_at?: string }
      }
      profiles: {
        Row: { id: string; organization_id: string | null; full_name: string | null; avatar_url: string | null; phone: string | null; job_title: string | null; timezone: string; locale: string; created_at: string; updated_at: string }
        Insert: { id: string; organization_id?: string | null; full_name?: string | null; avatar_url?: string | null; phone?: string | null; job_title?: string | null; timezone?: string; locale?: string; created_at?: string; updated_at?: string }
        Update: { organization_id?: string | null; full_name?: string | null; avatar_url?: string | null; phone?: string | null; job_title?: string | null; timezone?: string; locale?: string; updated_at?: string }
      }
      user_roles: {
        Row: { id: string; user_id: string; organization_id: string; role: AppRole; created_at: string }
        Insert: { id?: string; user_id: string; organization_id: string; role?: AppRole; created_at?: string }
        Update: { role?: AppRole }
      }
      sectors: {
        Row: { id: string; organization_id: string; name: string; description: string | null; color: string; icon: string; is_active: boolean; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; organization_id: string; name: string; description?: string | null; color?: string; icon?: string; is_active?: boolean; created_by?: string | null }
        Update: { name?: string; description?: string | null; color?: string; icon?: string; is_active?: boolean; updated_at?: string }
      }
      sector_members: {
        Row: { id: string; sector_id: string; user_id: string; organization_id: string; is_supervisor: boolean; added_at: string }
        Insert: { id?: string; sector_id: string; user_id: string; organization_id: string; is_supervisor?: boolean }
        Update: { is_supervisor?: boolean }
      }
      user_permissions: {
        Row: { id: string; user_id: string; organization_id: string; can_view_own_conversations: boolean; can_view_queue: boolean; can_view_other_users: boolean; can_view_other_queues: boolean; can_view_unassigned: boolean; can_accept_conversations: boolean; can_transfer_conversations: boolean; can_close_conversations: boolean; can_view_all_leads: boolean; can_edit_leads: boolean; can_delete_leads: boolean; can_export_leads: boolean; can_view_reports: boolean; can_view_team_reports: boolean; can_manage_team: boolean; can_manage_settings: boolean; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; organization_id: string; can_view_own_conversations?: boolean; can_view_queue?: boolean; can_view_other_users?: boolean; can_view_other_queues?: boolean; can_view_unassigned?: boolean; can_accept_conversations?: boolean; can_transfer_conversations?: boolean; can_close_conversations?: boolean; can_view_all_leads?: boolean; can_edit_leads?: boolean; can_delete_leads?: boolean; can_export_leads?: boolean; can_view_reports?: boolean; can_view_team_reports?: boolean; can_manage_team?: boolean; can_manage_settings?: boolean }
        Update: { can_view_own_conversations?: boolean; can_view_queue?: boolean; can_view_other_users?: boolean; can_view_other_queues?: boolean; can_view_unassigned?: boolean; can_accept_conversations?: boolean; can_transfer_conversations?: boolean; can_close_conversations?: boolean; can_view_all_leads?: boolean; can_edit_leads?: boolean; can_delete_leads?: boolean; can_export_leads?: boolean; can_view_reports?: boolean; can_view_team_reports?: boolean; can_manage_team?: boolean; can_manage_settings?: boolean; updated_at?: string }
      }
      products: {
        Row: { id: string; organization_id: string; name: string; description: string | null; price: number | null; currency: string; image_url: string | null; is_active: boolean; default_sector_id: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; organization_id: string; name: string; description?: string | null; price?: number | null; currency?: string; image_url?: string | null; is_active?: boolean; default_sector_id?: string | null; created_by?: string | null }
        Update: { name?: string; description?: string | null; price?: number | null; currency?: string; image_url?: string | null; is_active?: boolean; default_sector_id?: string | null; updated_at?: string }
      }
      pipeline_stages: {
        Row: { id: string; organization_id: string; product_id: string; name: string; description: string | null; color: string; position: number; is_won: boolean; is_lost: boolean; probability: number; created_at: string; updated_at: string }
        Insert: { id?: string; organization_id: string; product_id: string; name: string; description?: string | null; color?: string; position?: number; is_won?: boolean; is_lost?: boolean; probability?: number }
        Update: { name?: string; description?: string | null; color?: string; position?: number; is_won?: boolean; is_lost?: boolean; probability?: number; updated_at?: string }
      }
      custom_fields: {
        Row: { id: string; organization_id: string; product_id: string | null; name: string; label: string; field_type: CustomFieldType; options: Json; is_required: boolean; is_active: boolean; position: number; created_at: string }
        Insert: { id?: string; organization_id: string; product_id?: string | null; name: string; label: string; field_type?: CustomFieldType; options?: Json; is_required?: boolean; is_active?: boolean; position?: number }
        Update: { name?: string; label?: string; field_type?: CustomFieldType; options?: Json; is_required?: boolean; is_active?: boolean; position?: number }
      }
      product_offers: {
        Row: { id: string; organization_id: string; product_id: string; name: string; description: string | null; price: number; currency: string; payment_type: string; installments: number | null; is_active: boolean; external_url: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; organization_id: string; product_id: string; name: string; description?: string | null; price?: number; currency?: string; payment_type?: string; installments?: number | null; is_active?: boolean; external_url?: string | null }
        Update: { name?: string; description?: string | null; price?: number; currency?: string; payment_type?: string; installments?: number | null; is_active?: boolean; external_url?: string | null; updated_at?: string }
      }
      product_ctas: {
        Row: { id: string; organization_id: string; product_id: string; label: string; url: string | null; cta_type: string; is_primary: boolean; position: number; created_at: string }
        Insert: { id?: string; organization_id: string; product_id: string; label: string; url?: string | null; cta_type?: string; is_primary?: boolean; position?: number }
        Update: { label?: string; url?: string | null; cta_type?: string; is_primary?: boolean; position?: number }
      }
    }
    Functions: {
      get_user_organization: { Args: { p_user_id: string }; Returns: string }
      has_role: { Args: { p_user_id: string; p_role: AppRole }; Returns: boolean }
      has_role_or_above: { Args: { p_user_id: string; p_min_role: AppRole }; Returns: boolean }
      has_sector_access: { Args: { p_user_id: string; p_sector_id: string }; Returns: boolean }
      initialize_user_permissions: { Args: { p_user_id: string; p_org_id: string; p_role: AppRole }; Returns: void }
    }
    Enums: {
      app_role: AppRole
      custom_field_type: CustomFieldType
    }
  }
}
