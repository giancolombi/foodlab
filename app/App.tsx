import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import AppLayout from "@/components/layout/AppLayout";
import ProtectedRoute from "@/components/layout/ProtectedRoute";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PlanProvider } from "@/contexts/PlanContext";
import IngredientMatcher from "@/pages/IngredientMatcher";
import Plan from "@/pages/Plan";
import Profiles from "@/pages/Profiles";
import RecipeDetail from "@/pages/RecipeDetail";
import Recipes from "@/pages/Recipes";
import SignIn from "@/pages/SignIn";
import SignUp from "@/pages/SignUp";

export default function App() {
  return (
    <LanguageProvider>
    <AuthProvider>
      <PlanProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                <Route index element={<IngredientMatcher />} />
                <Route path="recipes" element={<Recipes />} />
                <Route path="recipes/:slug" element={<RecipeDetail />} />
                <Route path="profiles" element={<Profiles />} />
                <Route path="plan" element={<Plan />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </PlanProvider>
    </AuthProvider>
    </LanguageProvider>
  );
}
