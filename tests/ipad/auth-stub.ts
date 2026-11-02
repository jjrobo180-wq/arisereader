// An eye-gaze student, for the iPad test page (tests/ipad).
export const useAuth = () => ({ token: "t", user: { id: 5, role: "student", is_eye_gaze_user: true, displayName: "Ava", username: "ava", isAdmin: false }, logout: () => {}, login: async () => {} });
export const AuthProvider = ({ children }: any) => children;
