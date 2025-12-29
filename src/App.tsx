import { useEffect, useState, type FormEvent } from "react";
import { createClient, type User } from "@supabase/supabase-js";

/* -------------------- TYPES -------------------- */
interface Task {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  ai_generated: boolean;
  created_at: string;
  user_id: string;
}

/* -------------------- SUPABASE -------------------- */
const supabase = createClient(
  "https://kobnwzimneejuvwjytcz.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtvYm53emltbmVlanV2d2p5dGN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5OTA3NTYsImV4cCI6MjA4MjU2Njc1Nn0.nUldOvFldqLlv37nrQu8cOFiKtV_kP7osvivddzUDAg"
);

/* -------------------- APP -------------------- */
export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [useAI, setUseAI] = useState(false);

  /* -------------------- AUTH -------------------- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
      if (data.session?.user) loadTasks();
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        session?.user ? loadTasks() : setTasks([]);
      }
    );

    return () => listener.subscription.unsubscribe();
  }, []);

  /* -------------------- TASKS -------------------- */
  async function loadTasks() {
    const { data } = await supabase
      .from("tasks")
      .select("*")
      .order("created_at", { ascending: false });

    setTasks((data as Task[]) || []);
  }

  async function createTask(e: FormEvent) {
    e.preventDefault();
    setLoading(true);

    await supabase.functions.invoke("create-task", {
      body: { title: taskTitle, useAI },
    });

    setTaskTitle("");
    setUseAI(false);
    setLoading(false);
    loadTasks();
  }

  async function toggleTask(task: Task) {
    await supabase
      .from("tasks")
      .update({ completed: !task.completed })
      .eq("id", task.id);

    loadTasks();
  }

  async function signIn() {
    setLoading(true);
    await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
  }

  async function signUp() {
    setLoading(true);
    await supabase.auth.signUp({ email, password });
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  /* -------------------- AUTH UI -------------------- */
  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-base-200 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-base-300 bg-base-100 p-7">
          <h1 className="text-2xl font-semibold text-center mb-6">
            Task Manager
          </h1>

          <input
            className="input input-bordered w-full mb-3"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            className="input input-bordered w-full mb-6"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <div className="flex gap-3">
            <button
              className="btn btn-neutral flex-1"
              onClick={signIn}
              disabled={loading}
            >
              Sign In
            </button>
            <button
              className="btn btn-outline flex-1"
              onClick={signUp}
              disabled={loading}
            >
              Sign Up
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* -------------------- DASHBOARD UI -------------------- */
  return (
    <div className="min-h-screen bg-base-200 px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold">My Tasks</h1>
          <button className="btn btn-xs btn-ghost" onClick={signOut}>
            Logout
          </button>
        </div>

        {/* Create Task */}
        <form
          onSubmit={createTask}
          className="rounded-2xl border border-base-300 bg-base-100 p-6 space-y-4"
        >
          <input
            className="input input-bordered w-full"
            placeholder="What needs to be done?"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            required
          />

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={useAI}
              onChange={(e) => setUseAI(e.target.checked)}
            />
            Generate description with AI
          </label>

          <button
            type="submit"
            className="btn btn-neutral w-full"
            disabled={loading}
          >
            {loading ? "Creating..." : "Add Task"}
          </button>
        </form>

        {/* Task List */}
        <div className="space-y-3">
          {tasks.length === 0 && (
            <p className="text-center text-sm opacity-60">
              No tasks yet — start by adding one.
            </p>
          )}

          {tasks.map((task) => (
            <div
              key={task.id}
              className="rounded-2xl border border-base-300 bg-base-100 p-4 flex gap-3 hover:bg-base-200 transition"
            >
              <input
                type="checkbox"
                className="checkbox checkbox-sm mt-1"
                checked={task.completed}
                onChange={() => toggleTask(task)}
              />

              <div className="flex-1">
                <h3
                  className={`font-medium ${
                    task.completed ? "line-through opacity-50" : ""
                  }`}
                >
                  {task.title}
                </h3>

                {task.description && (
                  <p className="text-sm opacity-70 mt-1">
                    {task.description}
                  </p>
                )}

                {task.ai_generated && (
                  <span className="badge badge-outline badge-sm mt-2">
                    AI
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
