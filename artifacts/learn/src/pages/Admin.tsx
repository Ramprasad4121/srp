import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface CustomTopic {
  id: string;
  title: string;
  description: string;
  content: string;
  duration: number;
  tags: string;
  createdAt: string;
}

const ADMIN_KEY = "srp_admin_auth";
const TOPICS_KEY = "srp_custom_topics";
// Demo-only local PIN — not server-side auth. Change this to your own value.
const PASSWORD = "srp2024";

interface Props {
  onBack: () => void;
}

function loadTopics(): CustomTopic[] {
  try { return JSON.parse(localStorage.getItem(TOPICS_KEY) || "[]"); }
  catch { return []; }
}

function saveTopics(topics: CustomTopic[]) {
  localStorage.setItem(TOPICS_KEY, JSON.stringify(topics));
}

export function getCustomTopics(): CustomTopic[] {
  return loadTopics();
}

export default function Admin({ onBack }: Props) {
  const [authed, setAuthed] = useState(() => localStorage.getItem(ADMIN_KEY) === "true");
  const [pw, setPw] = useState("");
  const [pwError, setPwError] = useState(false);

  const handleLogin = () => {
    if (pw === PASSWORD) {
      localStorage.setItem(ADMIN_KEY, "true");
      setAuthed(true);
    } else {
      setPwError(true);
      setTimeout(() => setPwError(false), 2000);
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm space-y-8"
        >
          <div>
            <div className="label-mono mb-2">SRP LEARN</div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Admin Access</h1>
            <p className="text-sm text-muted-foreground mt-2 font-mono">Restricted area — enter password to continue</p>
          </div>
          <div className="space-y-3">
            <input
              type="password"
              value={pw}
              onChange={e => setPw(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleLogin()}
              placeholder="Password"
              autoFocus
              className={`w-full border ${pwError ? "border-red-400 bg-red-50" : "border-border"} bg-background text-foreground font-mono text-sm px-4 py-3 outline-none focus:border-foreground transition-colors`}
            />
            <AnimatePresence>
              {pwError && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-xs text-red-500"
                >
                  Incorrect password
                </motion.p>
              )}
            </AnimatePresence>
            <button onClick={handleLogin} className="w-full btn-arrow justify-center py-3">
              Enter →
            </button>
          </div>
          <button onClick={onBack} className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
            ← Back to app
          </button>
        </motion.div>
      </div>
    );
  }

  return <AdminPanel onBack={onBack} />;
}

const EMPTY_FORM = { title: "", description: "", content: "", duration: "5", tags: "" };

function AdminPanel({ onBack }: { onBack: () => void }) {
  const [topics, setTopics] = useState<CustomTopic[]>(loadTopics);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const field = (key: keyof typeof EMPTY_FORM) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [key]: e.target.value })),
  });

  const handleSubmit = () => {
    if (!form.title.trim() || !form.description.trim()) return;
    const topic: CustomTopic = {
      id: editId ?? `custom-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      content: form.content.trim(),
      duration: parseInt(form.duration) || 5,
      tags: form.tags.trim(),
      createdAt: new Date().toISOString(),
    };
    const updated = editId
      ? topics.map(t => t.id === editId ? topic : t)
      : [...topics, topic];
    setTopics(updated);
    saveTopics(updated);
    setForm(EMPTY_FORM);
    setEditId(null);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleEdit = (t: CustomTopic) => {
    setForm({ title: t.title, description: t.description, content: t.content, duration: String(t.duration), tags: t.tags });
    setEditId(t.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (id: string) => {
    const updated = topics.filter(t => t.id !== id);
    setTopics(updated);
    saveTopics(updated);
    setDeleteConfirm(null);
  };

  const handleLogout = () => {
    localStorage.removeItem(ADMIN_KEY);
    onBack();
  };

  const inputCls = "w-full border border-border bg-background text-foreground text-sm px-3 py-2.5 outline-none focus:border-foreground transition-colors font-sans";
  const monoInputCls = "w-full border border-border bg-background text-foreground font-mono text-xs px-3 py-2.5 outline-none focus:border-foreground transition-colors resize-y";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onBack} className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← App
            </button>
            <span className="text-border">|</span>
            <span className="font-mono text-xs font-bold tracking-widest text-foreground">ADMIN PANEL</span>
          </div>
          <button onClick={handleLogout} className="font-mono text-xs text-red-400 hover:text-red-600 transition-colors">
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-10">
        {/* Page heading */}
        <div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Manage Topics</h1>
          <p className="text-sm text-muted-foreground mt-1.5 font-mono">
            Add custom learning topics — they appear in the Dashboard on this device.
          </p>
        </div>

        {/* Form */}
        <div className="border border-border p-6 space-y-5">
          <h2 className="font-mono text-xs font-bold tracking-widest text-foreground">
            {editId ? "— EDIT TOPIC" : "— NEW TOPIC"}
          </h2>

          <div className="space-y-4">
            <div>
              <label className="label-mono block mb-1.5">Title *</label>
              <input {...field("title")} placeholder="e.g. Advanced Yul Assembly" className={inputCls} />
            </div>
            <div>
              <label className="label-mono block mb-1.5">Description *</label>
              <input {...field("description")} placeholder="One-line summary shown in the path list" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label-mono block mb-1.5">Duration (minutes)</label>
                <input {...field("duration")} type="number" min="1" className={inputCls} />
              </div>
              <div>
                <label className="label-mono block mb-1.5">Tags (comma-separated)</label>
                <input {...field("tags")} placeholder="yul, advanced, gas" className={inputCls} />
              </div>
            </div>
            <div>
              <label className="label-mono block mb-1.5">Content (Markdown)</label>
              <textarea {...field("content")} rows={10}
                placeholder={`# Topic Title\n\nWrite the full lesson content here using Markdown.\n\n**Key concepts:**\n- Concept one\n- Concept two\n\nCode examples, explanations, everything goes here.`}
                className={monoInputCls}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <button
              onClick={handleSubmit}
              disabled={!form.title.trim() || !form.description.trim()}
              className="btn-arrow disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {editId ? "Update Topic →" : "Save Topic →"}
            </button>
            {editId && (
              <button
                onClick={() => { setEditId(null); setForm(EMPTY_FORM); }}
                className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            )}
            <AnimatePresence>
              {saved && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-xs text-green-600 font-medium"
                >
                  ✓ Saved successfully
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Topic list */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-xs font-bold tracking-widest text-foreground">
              — EXISTING TOPICS ({topics.length})
            </h2>
          </div>

          {topics.length === 0 ? (
            <div className="border border-dashed border-border p-10 text-center">
              <p className="font-mono text-xs text-muted-foreground">No custom topics yet. Add one above.</p>
            </div>
          ) : (
            <div className="border border-border divide-y divide-border">
              {topics.map(t => (
                <motion.div key={t.id} layout className="p-5 flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground">{t.title}</div>
                    <div className="font-mono text-xs text-muted-foreground mt-0.5 leading-relaxed">{t.description}</div>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="font-mono text-[10px] text-muted-foreground">{t.duration} min</span>
                      {t.tags && (
                        <>
                          <span className="text-border">·</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{t.tags}</span>
                        </>
                      )}
                      <span className="text-border">·</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <button onClick={() => handleEdit(t)}
                      className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Edit
                    </button>
                    {deleteConfirm === t.id ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-red-500">Sure?</span>
                        <button onClick={() => handleDelete(t.id)}
                          className="font-mono text-xs text-red-500 hover:text-red-700 font-bold transition-colors">Yes</button>
                        <button onClick={() => setDeleteConfirm(null)}
                          className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(t.id)}
                        className="font-mono text-xs text-red-400 hover:text-red-600 transition-colors">
                        Delete
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
