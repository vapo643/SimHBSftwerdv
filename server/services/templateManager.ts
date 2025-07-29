import { PDFTemplate, CCB_TEMPLATE } from './pdfTemplateEngine';
import { createServerSupabaseAdminClient } from '../lib/supabase';

export class TemplateManager {
  private static templates: Map<string, PDFTemplate> = new Map();

  static {
    // Initialize with default templates
    this.templates.set(CCB_TEMPLATE.id, CCB_TEMPLATE);
  }

  public static async getAllTemplates(): Promise<PDFTemplate[]> {
    // First, load templates from database
    await this.loadTemplatesFromDatabase();
    return Array.from(this.templates.values());
  }

  public static async getTemplate(id: string): Promise<PDFTemplate | null> {
    // Check in-memory cache first
    if (this.templates.has(id)) {
      return this.templates.get(id)!;
    }

    // Try to load from database
    await this.loadTemplatesFromDatabase();
    return this.templates.get(id) || null;
  }

  public static async saveTemplate(template: PDFTemplate): Promise<void> {
    const supabase = createServerSupabaseAdminClient();

    try {
      // Save to database
      const { error } = await supabase
        .from('pdf_templates')
        .upsert({
          id: template.id,
          name: template.name,
          description: template.description,
          template_data: template,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error saving template to database:', error);
        throw new Error(`Failed to save template: ${error.message}`);
      }

      // Update in-memory cache
      this.templates.set(template.id, template);
      console.log(`✅ Template ${template.id} saved successfully`);

    } catch (error) {
      console.error('Error in saveTemplate:', error);
      throw error;
    }
  }

  public static async deleteTemplate(id: string): Promise<void> {
    // Don't allow deletion of default templates
    if (id === CCB_TEMPLATE.id) {
      throw new Error('Cannot delete default template');
    }

    const supabase = createServerSupabaseAdminClient();

    try {
      const { error } = await supabase
        .from('pdf_templates')
        .delete()
        .eq('id', id);

      if (error) {
        throw new Error(`Failed to delete template: ${error.message}`);
      }

      // Remove from cache
      this.templates.delete(id);
      console.log(`✅ Template ${id} deleted successfully`);

    } catch (error) {
      console.error('Error in deleteTemplate:', error);
      throw error;
    }
  }

  public static async duplicateTemplate(sourceId: string, newName: string, newDescription?: string): Promise<PDFTemplate> {
    const sourceTemplate = await this.getTemplate(sourceId);
    if (!sourceTemplate) {
      throw new Error(`Template ${sourceId} not found`);
    }

    // Create new template with modified properties
    const newTemplate: PDFTemplate = {
      ...JSON.parse(JSON.stringify(sourceTemplate)), // Deep clone
      id: `${sourceId}-copy-${Date.now()}`,
      name: newName,
      description: newDescription || `Copy of ${sourceTemplate.description}`
    };

    await this.saveTemplate(newTemplate);
    return newTemplate;
  }

  private static async loadTemplatesFromDatabase(): Promise<void> {
    const supabase = createServerSupabaseAdminClient();

    try {
      const { data: templates, error } = await supabase
        .from('pdf_templates')
        .select('*');

      if (error) {
        console.error('Error loading templates from database:', error);
        return;
      }

      if (templates) {
        for (const template of templates) {
          this.templates.set(template.id, template.template_data);
        }
        console.log(`📁 Loaded ${templates.length} templates from database`);
      }

    } catch (error) {
      console.error('Error in loadTemplatesFromDatabase:', error);
    }
  }

  public static createCustomTemplate(
    id: string,
    name: string,
    description: string,
    baseTemplate?: PDFTemplate
  ): PDFTemplate {
    const template: PDFTemplate = baseTemplate ? 
      JSON.parse(JSON.stringify(baseTemplate)) : 
      JSON.parse(JSON.stringify(CCB_TEMPLATE));

    template.id = id;
    template.name = name;
    template.description = description;

    return template;
  }

  public static validateTemplate(template: PDFTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!template.id) errors.push('Template ID is required');
    if (!template.name) errors.push('Template name is required');
    if (!template.sections || template.sections.length === 0) {
      errors.push('Template must have at least one section');
    }

    // Validate sections
    template.sections.forEach((section, index) => {
      if (!section.id) errors.push(`Section ${index + 1} is missing ID`);
      if (!section.position) errors.push(`Section ${index + 1} is missing position`);
      
      // Validate fields
      if (section.fields) {
        section.fields.forEach((field, fieldIndex) => {
          if (!field.id) errors.push(`Field ${fieldIndex + 1} in section ${section.id} is missing ID`);
          if (!field.dataPath) errors.push(`Field ${fieldIndex + 1} in section ${section.id} is missing dataPath`);
          if (!field.position) errors.push(`Field ${fieldIndex + 1} in section ${section.id} is missing position`);
        });
      }
    });

    return {
      valid: errors.length === 0,
      errors
    };
  }
}