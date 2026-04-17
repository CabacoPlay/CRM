import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Mail, Bot, MessageCircle, Filter, CalendarCheck, Brain } from 'lucide-react';

export default function AuthPage() {
  const { user, login, sendAuthToken } = useAuth();
  const [step, setStep] = useState<'email' | 'token'>('email');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Redirect if already authenticated
  if (user) {
    const redirectPath = user.papel === 'admin' || user.papel === 'owner' 
      ? '/admin/empresas' 
      : '/app/chat';
    return <Navigate to={redirectPath} replace />;
  }

  const handleSendToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    const result = await sendAuthToken(email);
    
    if (result.success) {
      setSuccess('Token enviado! Verifique seu email.');
      setStep('token');
    } else {
      setError(result.error || 'Erro ao enviar token');
    }
    
    setIsLoading(false);
  };

  const handleVerifyToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const result = await login(email, token);
    
    if (!result.success) {
      setError(result.error || 'Token inválido');
      setIsLoading(false);
    }
    // If successful, the user will be redirected by the Navigate component above
  };

  const resetForm = () => {
    setStep('email');
    setEmail('');
    setToken('');
    setError('');
    setSuccess('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 p-0 md:p-6 flex items-center justify-center">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden shadow-2xl border border-border/50">
          {/* Lado Esquerdo - Visual e Features */}
          <div className="relative bg-primary/5 p-8 md:p-12">
            <div className="flex items-center gap-3 text-primary font-bold text-xl">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <span>F5 CRM</span>
            </div>
            <div className="mt-8 space-y-4">
              <h1 className="text-2xl md:text-3xl font-extrabold leading-tight">
                Potencialize suas vendas com Inteligência Artificial
              </h1>
              <p className="text-muted-foreground">
                O sistema completo para gestão do seu negócio.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-6">
                <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2 border border-border/50">
                  <MessageCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">WhatsApp Integrado</span>
                </div>
                <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2 border border-border/50">
                  <Filter className="w-4 h-4 text-primary" />
                  <span className="text-sm">Funis de Vendas</span>
                </div>
                <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2 border border-border/50">
                  <CalendarCheck className="w-4 h-4 text-primary" />
                  <span className="text-sm">Agendamentos</span>
                </div>
                <div className="flex items-center gap-2 bg-background/60 rounded-xl px-3 py-2 border border-border/50">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-sm">Automação IA</span>
                </div>
              </div>
              <div className="absolute -right-20 bottom-10 w-40 h-40 bg-primary/10 rounded-full blur-2xl" />
            </div>
          </div>

          {/* Lado Direito - Formulário */}
          <div className="bg-background p-8 md:p-12">
            <div className="max-w-md">
              <div className="space-y-1">
                <h2 className="text-2xl font-bold">Bem-vindo ao seu CRM</h2>
                <p className="text-sm text-muted-foreground">
                  Receba seu código de acesso por email
                </p>
              </div>

              <div className="space-y-6 mt-6">
                {error && (
                  <Alert variant="destructive" className="border-destructive/20 bg-destructive/5">
                    <AlertDescription className="text-sm">{error}</AlertDescription>
                  </Alert>
                )}
                
                {success && (
                  <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
                    <AlertDescription className="text-sm">{success}</AlertDescription>
                  </Alert>
                )}

                {step === 'email' ? (
                  <form onSubmit={handleSendToken} className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="email" className="text-sm font-medium">
                        Email
                      </Label>
                      <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                        </div>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="seu@email.com"
                          required
                          disabled={isLoading}
                          className="h-12 text-base pl-9"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Enviaremos o token diretamente para seu email.
                      </p>
                    </div>
                    
                    <Button type="submit" className="w-full h-12 text-base font-medium" disabled={isLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        'Enviar Código'
                      )}
                    </Button>
                  </form>
                ) : (
                  <form onSubmit={handleVerifyToken} className="space-y-6">
                    <div className="space-y-3">
                      <Label htmlFor="email-display" className="text-sm font-medium">Email</Label>
                      <Input
                        id="email-display"
                        type="email"
                        value={email}
                        disabled
                        className="bg-muted/50 h-12 text-base"
                      />
                    </div>
                    
                    <div className="space-y-3">
                      <Label htmlFor="token" className="text-sm font-medium">Código de 3 dígitos</Label>
                      <Input
                        id="token"
                        type="text"
                        value={token}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '').slice(0, 3);
                          setToken(value);
                        }}
                        placeholder="123"
                        required
                        disabled={isLoading}
                        className="text-center text-2xl tracking-[0.5em] h-16 font-mono"
                        maxLength={3}
                      />
                    </div>
                    
                    <div className="flex gap-3 pt-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={resetForm}
                        disabled={isLoading}
                        className="flex-1 h-12 text-base"
                      >
                        Voltar
                      </Button>
                      <Button type="submit" disabled={isLoading || token.length !== 3} className="flex-1 h-12 text-base font-medium">
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          'Entrar'
                        )}
                      </Button>
                    </div>
                  </form>
                )}

                <p className="text-xs text-muted-foreground">
                  Problemas com o acesso? <a href="https://api.whatsapp.com/send/?phone=11910469931&text&type=phone_number&app_absent=0" className="underline">Contate o suporte</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
