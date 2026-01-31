
import { createClient } from '@supabase/supabase-js';

const getEnv = (name: string): string | undefined => {
  try {
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      // @ts-ignore
      return import.meta.env[name];
    }
    // @ts-ignore
    if (typeof process !== 'undefined' && process.env) {
      return process.env[name];
    }
  } catch (e) {
    return undefined;
  }
  return undefined;
};

const supabaseUrl = getEnv('VITE_SUPABASE_URL') || 'https://ptbyeiuzfnsreeioqeco.supabase.co';
const supabaseKey = getEnv('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0YnllaXV6Zm5zcmVlaW9xZWNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxNDEzNzYsImV4cCI6MjA4NDcxNzM3Nn0.raVOXrqmHAXLmGN05I7qYy2BtInzwCwZGSpO9dRHEis';

export const supabase = createClient(supabaseUrl, supabaseKey);

// ネットワークエラーやメンテナンス中かどうかを判定
export const isOperationalError = (error: any) => {
  if (!error) return false;
  const msg = error.message || "";
  return msg.includes('Failed to fetch') || error.code === 'PGRST301' || msg.includes('NetworkError');
};

export const db = {
  storage: {
    async upload(path: string, base64Data: string) {
      try {
        const response = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, file: base64Data }),
        });
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.message || 'R2 Upload Failed');
        }
        const { url } = await response.json();
        return url;
      } catch (err) {
        console.error("[Storage] Upload failed:", err);
        throw err;
      }
    }
  },
  submissions: {
    async fetchAll() {
      try {
        const { data, error } = await supabase.from('submissions').select('*').order('timestamp', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        if (isOperationalError(e)) return [];
        throw e;
      }
    },
    async fetchByUser(userId: string) {
      try {
        const { data, error } = await supabase.from('submissions').select('*').eq('ownerId', userId).order('timestamp', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        return [];
      }
    },
    async fetchByEditor(editorId: string) {
      try {
        const { data, error } = await supabase.from('submissions').select('*').eq('assignedEditorId', editorId).order('timestamp', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        return [];
      }
    },
    async insert(submission: any) {
      const { error } = await supabase.from('submissions').insert([submission]);
      if (error) throw error;
    },
    async update(id: string, updates: any) {
      const { error } = await supabase.from('submissions').update(updates).eq('id', id);
      if (error) throw error;
    },
    async delete(id: string) {
      const { error } = await supabase.from('submissions').delete().eq('id', id);
      if (error) throw error;
    }
  },
  plans: {
    async fetchAll() {
      try {
        const { data, error } = await supabase.from('plans').select('*').order('number', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (e) {
        return [];
      }
    },
    async insert(plan: any) {
      const { error } = await supabase.from('plans').insert([plan]);
      if (error) throw error;
    },
    async update(id: string, updates: any) {
      const { error } = await supabase.from('plans').update(updates).eq('id', id);
      if (error) throw error;
    },
    async delete(id: string) {
      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw error;
    }
  },
  archive: {
    async fetchAll() {
      try {
        const { data, error } = await supabase.from('archive_projects').select('*').order('timestamp', { ascending: false });
        if (error) throw error;
        return data || [];
      } catch (e) {
        return [];
      }
    },
    async insert(project: any) {
      const { error } = await supabase.from('archive_projects').insert([project]);
      if (error) throw error;
    },
    async delete(id: string) {
      const { error } = await supabase.from('archive_projects').delete().eq('id', id);
      if (error) throw error;
    }
  },
  editors: {
    async fetchAll() {
      try {
        const { data, error } = await supabase.from('editors').select('*').order('name');
        if (error) throw error;
        return data || [];
      } catch (e) {
        return [];
      }
    },
    async insert(editor: any) {
      const { error } = await supabase.from('editors').insert([editor]);
      if (error) throw error;
    },
    async delete(id: string) {
      const { error } = await supabase.from('editors').delete().eq('id', id);
      if (error) throw error;
    }
  },
  messages: {
    async fetchBySubmission(submissionId: string) {
      try {
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('submission_id', submissionId)
          .order('timestamp', { ascending: true });
        
        if (error) {
          if (error.code === 'PGRST204' || error.code === 'PGRST205') return { error: 'TABLE_MISSING' };
          throw error;
        }
        return data || [];
      } catch (e) {
        if (isOperationalError(e)) return [];
        throw e;
      }
    },
    async fetchAll() {
      try {
        const { data, error } = await supabase.from('messages').select('*').order('timestamp', { ascending: false });
        if (error) {
          if (error.code === 'PGRST204' || error.code === 'PGRST205') return [];
          throw error;
        }
        return data || [];
      } catch (e) {
        return [];
      }
    },
    async insert(message: any) {
      const { error } = await supabase.from('messages').insert([message]);
      if (error) throw error;
    }
  }
};
