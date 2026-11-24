
export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) {
      setError("Supabase connection is missing.");
      setLoading(false);
      return;
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setError(error.message);
      setSession(data?.session ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!session?.user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("id", session.user.id)
        .single();

      if (!active) return;

      if (error) {
        setError(error.message);
        setProfile(null);
      } else {
        setProfile(data);
        setError("");
      }
    }

    loadProfile();

    return () => {
      active = false;
    };
  }, [session]);

  async function logout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError(error.message);
    } else {
      setSession(null);
      setProfile(null);
      setError("");
    }
  }

  if (!supabase) {
    return <p>Supabase connection is not configured. Check your .env file.</p>;
  }

  if (loading) {
    return <p>Loading SpiceLedger CRM...</p>;
  }

  if (!session) {
    return <Auth />;
  }

  if (!profile) {
    return (
      <div style={{ padding: 30 }}>
        <p>{error || "Loading your profile..."}</p>
        <button onClick={logout}>Logout</button>
      </div>
    );
  }

  return (
    <Workspace
      user={session.user}
      profile={profile}
      onLogout={logout}
    />
  );
}
