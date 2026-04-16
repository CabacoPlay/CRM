import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/app-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, Mail, Palette } from 'lucide-react';

export default function AdminConfiguracoes() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie integrações globais do painel administrativo.</p>
        </div>

        <div className="grid gap-4 max-w-5xl grid-cols-1 md:grid-cols-2">
        <Card
          className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-muted/20 hover:shadow-lg transition-all cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/admin/configuracoes/resend')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/admin/configuracoes/resend');
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Resend (E-mail)
            </CardTitle>
            <CardDescription>
              Configure o título/remetente e o token da API para envio de token de acesso por e-mail.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-muted/20 hover:shadow-lg transition-all cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/admin/pagamentos-config')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/admin/pagamentos-config');
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pagamentos (Mercado Pago)
            </CardTitle>
            <CardDescription>
              Configure o Pix do Mercado Pago (Access Token, Webhook Secret e testes).
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>

        <Card
          className="bg-card/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 hover:bg-muted/20 hover:shadow-lg transition-all cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => navigate('/admin/branding')}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') navigate('/admin/branding');
          }}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Branding
            </CardTitle>
            <CardDescription>
              Ajuste nome do sistema, logo e cores do projeto.
            </CardDescription>
          </CardHeader>
          <CardContent />
        </Card>
        </div>
      </div>
    </AppLayout>
  );
}
