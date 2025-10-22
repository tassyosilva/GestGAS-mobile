import { storageService } from "./services/storageService";
import { authService } from "./services/authService";

export async function testStorage() {
  console.log("=== Teste de Storage ===");

  // Salvar
  await storageService.setServerUrl("https://teste.com");
  console.log("✅ URL salva");

  // Recuperar
  const url = await storageService.getServerUrl();
  console.log("✅ URL recuperada:", url);

  // Limpar
  await storageService.clearAll();
  console.log("✅ Storage limpo");
}

export async function testAuth() {
  console.log("=== Teste de Auth ===");

  // Verificar autenticação
  const isAuth = await authService.isAuthenticated();
  console.log("✅ Está autenticado?", isAuth);
}

// Chamar no App.tsx para testar
