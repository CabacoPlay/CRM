import { useState, useEffect } from 'react';
import { QrCode, MessageCircle, Zap, RefreshCw, Bot } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton';
import { AppLayout } from '@/components/layout/app-layout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/auth-context';
import { useToast } from '@/hooks/use-toast';
import { mockIAs } from '@/lib/fixtures';
import { Connection, IA } from '@/types';

export function ConexoesContent({ showHeader = true }: { showHeader?: boolean }) {
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [availableIAs, setAvailableIAs] = useState<IA[]>([]);
  const [connectionIAs, setConnectionIAs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [iaModalOpen, setIaModalOpen] = useState(false);
  const [selectedConnection, setSelectedConnection] = useState<Connection | null>(null);
  const [selectedIA, setSelectedIA] = useState('');
  const [qrCodeData, setQrCodeData] = useState<any>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState<Record<string, boolean>>({});
  const [connectionStatuses, setConnectionStatuses] = useState<Record<string, string>>({});
  useEffect(() => {
    const loadData = async () => {
      if (!user?.empresa_id) return;
      try {
        setLoading(true);

        // Load connections with their assigned IAs
        const {
          data: connectionsData,
          error: connectionsError
        } = await supabase.from('conexoes').select(`
          *,
          ias!id_ia (
            id,
            nome
          )
        `).eq('empresa_id', user.empresa_id);
        if (connectionsError) {
          console.error('Erro ao carregar conexões:', connectionsError);
        } else {
          const connections = (connectionsData || []) as Connection[];
          setConnections(connections);
          
          // Populate connectionIAs state with existing assignments
          const iaAssignments: Record<string, string> = {};
          connections.forEach(connection => {
            if (connection.id_ia) {
              iaAssignments[connection.id] = connection.id_ia;
            }
          });
          setConnectionIAs(iaAssignments);
        }

        // Load available IAs
        const {
          data: iasData,
          error: iasError
        } = await supabase.from('ias').select('*').eq('empresa_id', user.empresa_id).eq('ativa', true);
        if (iasError) {
          console.error('Erro ao carregar IAs:', iasError);
        } else {
          setAvailableIAs((iasData || []) as IA[]);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user?.empresa_id]);
  useEffect(() => {
    // Check status for all connections when they're loaded
    connections.forEach(connection => {
      checkConnectionStatus(connection);
    });
  }, [connections]);
  const handleConnect = async (connection: Connection) => {
    if (!connection.globalkey || !connection.api_url || !connection.nome_api) {
      toast({
        title: "Erro na conexão",
        description: "Dados da conexão incompletos. Verifique se Global Key, URL da API e Nome da API estão preenchidos.",
        variant: "destructive"
      });
      return;
    }
    setSelectedConnection(connection);
    setConnectLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('whatsapp-connect', {
        body: {
          api_url: connection.api_url,
          nome_api: connection.nome_api,
          globalkey: connection.globalkey,
          apikey: connection.apikey
        }
      });
      if (error) throw error;
      setQrCodeData(data);
      setQrModalOpen(true);
      toast({
        title: "Conexão iniciada",
        description: "QR Code gerado com sucesso. Escaneie com o WhatsApp."
      });
    } catch (error) {
      console.error('Error connecting:', error);
      toast({
        title: "Erro na conexão",
        description: "Não foi possível conectar à API do WhatsApp.",
        variant: "destructive"
      });
    } finally {
      setConnectLoading(false);
    }
  };
  const handleRefreshConnection = async () => {
    if (!selectedConnection) return;
    setConnectLoading(true);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('whatsapp-connect', {
        body: {
          api_url: selectedConnection.api_url,
          nome_api: selectedConnection.nome_api,
          globalkey: selectedConnection.globalkey,
          apikey: selectedConnection.apikey
        }
      });
      if (error) throw error;
      setQrCodeData(data);
      toast({
        title: "QR Code atualizado",
        description: "Novo QR Code gerado com sucesso."
      });
    } catch (error) {
      console.error('Error refreshing connection:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar a conexão.",
        variant: "destructive"
      });
    } finally {
      setConnectLoading(false);
    }
  };
  const checkConnectionStatus = async (connection: Connection) => {
    if (!connection.apikey || !connection.api_url || !connection.nome_api) {
      setConnectionStatuses(prev => ({
        ...prev,
        [connection.id]: 'desconectado'
      }));
      return;
    }
    setStatusLoading(prev => ({
      ...prev,
      [connection.id]: true
    }));
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('whatsapp-status', {
        body: {
          api_url: connection.api_url,
          nome_api: connection.nome_api,
          apikey: connection.apikey
        }
      });
      if (error) throw error;
      setConnectionStatuses(prev => ({
        ...prev,
        [connection.id]: data.mappedStatus || 'desconectado'
      }));
    } catch (error) {
      console.error('Error checking status:', error);
      setConnectionStatuses(prev => ({
        ...prev,
        [connection.id]: 'desconectado'
      }));
    } finally {
      setStatusLoading(prev => ({
        ...prev,
        [connection.id]: false
      }));
    }
  };
  const handleAtribuirIA = (connection: Connection) => {
    setSelectedConnection(connection);
    // Use connection.id_ia if available, otherwise check connectionIAs state
    const currentIA = connection.id_ia || connectionIAs[connection.id];
    setSelectedIA(currentIA || 'none');
    setIaModalOpen(true);
  };
  const handleSaveIA = async () => {
    if (!selectedConnection) return;
    try {
      const normalizedIA = !selectedIA || selectedIA === "none" ? null : selectedIA;
      const tipo = normalizedIA ? "cadastro" : "remoção";

      // Send webhook with WhatsApp ID, IA ID (or null for unassignment), and tipo
      const {
        data,
        error
      } = await supabase.functions.invoke('whatsapp-webhook', {
        body: {
          whatsapp_id: selectedConnection.id,
          ia_id: normalizedIA,
          tipo: tipo
        }
      });
      if (error) throw error;

      // Update local state and database
      const updatedIAId = normalizedIA;
      
      // Update the connection in the database
      const { error: updateError } = await supabase
        .from('conexoes')
        .update({ id_ia: updatedIAId } as any)
        .eq('id', selectedConnection.id);
      
      if (updateError) throw updateError;
      
      // Update local connections state
      setConnections(prev => prev.map(conn => 
        conn.id === selectedConnection.id 
          ? { ...conn, id_ia: updatedIAId } as Connection
          : conn
      ));
      
      // Update connectionIAs state
      setConnectionIAs(prev => {
        const next = { ...prev };
        if (updatedIAId) {
          next[selectedConnection.id] = updatedIAId;
        } else {
          delete next[selectedConnection.id];
        }
        return next;
      });
      toast({
        title: updatedIAId ? "IA Atribuída" : "IA Desatribuída",
        description: updatedIAId ? `IA foi atribuída à conexão ${selectedConnection?.nome_api} e webhook enviado com sucesso.` : `IA foi desatribuída da conexão ${selectedConnection?.nome_api} e webhook enviado com sucesso.`
      });
    } catch (error) {
      console.error('Error sending webhook:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar webhook.",
        variant: "destructive"
      });
    }
    setIaModalOpen(false);
    setSelectedIA('');
  };
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'conectado':
        return 'connected';
      case 'conectando':
        return 'pending';
      case 'desconectado':
        return 'disconnected';
      default:
        return 'disconnected';
    }
  };
  if (loading) {
    return <div className="space-y-4 sm:space-y-6">
      {showHeader && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Conexões WhatsApp</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Gerencie suas conexões com as APIs do WhatsApp</p>
        </div>
      </div>}
      <div className="grid grid-cols-1 gap-4 sm:gap-6">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>;
  }
  return <div className="space-y-4 sm:space-y-6">
    {showHeader && <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Conexões WhatsApp</h1>
        <p className="text-sm sm:text-base text-muted-foreground">Gerencie suas conexões com as APIs do WhatsApp</p>
      </div>
    </div>}
    {connections.length === 0 ? <EmptyState icon={<QrCode className="h-8 w-8" />} title="Nenhuma conexão encontrada" description="As conexões disponíveis aparecerão aqui quando configuradas pelo administrador." /> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      {connections.map(connection => <Card key={connection.id} className="shadow-medium hover:shadow-large transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base sm:text-lg truncate">{connection.nome_api}</CardTitle>
            <Badge variant={getStatusVariant(connectionStatuses[connection.id] || 'desconectado')} className="shrink-0 text-xs flex items-center gap-1">
              {statusLoading[connection.id] && <RefreshCw className="h-3 w-3 animate-spin" />}
              {connectionStatuses[connection.id] || 'desconectado'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <MessageCircle className="h-4 w-4 text-success shrink-0" />
            <span className="text-muted-foreground truncate">
              {connection.telefone || '—'}
            </span>
          </div>
          {(connection.id_ia || connectionIAs[connection.id]) && <div className="flex items-center gap-2 text-xs sm:text-sm">
            <Bot className="h-4 w-4 text-primary shrink-0" />
            <span className="text-muted-foreground truncate">
              IA: {availableIAs.find(ia => ia.id === (connection.id_ia || connectionIAs[connection.id]))?.nome || 'IA Atribuída'}
            </span>
          </div>}
          <div className="space-y-2">
            <div className="flex gap-2">
              <Button size="sm" variant="default" onClick={() => handleConnect(connection)} disabled={connectLoading} className="flex-1 text-xs sm:text-sm">
                {connectLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <QrCode className="h-4 w-4 mr-2" />}
                Conectar
              </Button>
              <Button size="sm" variant="ghost" onClick={() => checkConnectionStatus(connection)} disabled={statusLoading[connection.id]} title="Atualizar Status" className="text-xs sm:text-sm">
                {statusLoading[connection.id] ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              </Button>
            </div>
            <Button size="sm" variant="outline" onClick={() => handleAtribuirIA(connection)} className="w-full text-xs sm:text-sm">
              <Zap className="h-4 w-4 mr-2" />
              Atribuir IA
            </Button>
          </div>
        </CardContent>
      </Card>)}
    </div>}
    <Dialog open={qrModalOpen} onOpenChange={open => {
      setQrModalOpen(open);
      if (!open) {
        setQrCodeData(null);
      }
    }}>
      <DialogContent className="sm:max-w-md mx-4">
        <DialogHeader>
          <DialogTitle>Conectar WhatsApp</DialogTitle>
          <DialogDescription>
            {qrCodeData?.base64 ? "Escaneie o QR Code abaixo com seu WhatsApp para conectar" : "Gerando QR Code..."}
          </DialogDescription>
        </DialogHeader>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Conectar WhatsApp</CardTitle>
            <CardDescription className="text-sm">
              {qrCodeData?.base64 ? "Escaneie o QR Code abaixo com seu WhatsApp para conectar" : "Gerando QR Code..."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <div className="flex justify-center">
              <div className="p-3 sm:p-4 bg-background border-2 border-dashed border-border rounded-lg">
                {qrCodeData?.base64 ? <img src={qrCodeData.base64} alt="QR Code do WhatsApp" className="h-40 w-40 sm:h-48 sm:w-48 object-contain" /> : <div className="h-40 w-40 sm:h-48 sm:w-48 flex items-center justify-center">
                  <div className="text-center">
                    {connectLoading ? <RefreshCw className="h-12 w-12 mx-auto mb-2 text-muted-foreground animate-spin" /> : <QrCode className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />}
                    <p className="text-sm text-muted-foreground">
                      {connectLoading ? "Gerando QR Code..." : "QR Code será exibido aqui"}
                    </p>
                  </div>
                </div>}
              </div>
            </div>
            {qrCodeData && <div className="space-y-3">
              <div className="flex justify-center">
                <Button variant="outline" onClick={handleRefreshConnection} disabled={connectLoading} size="sm">
                  {connectLoading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                  Atualizar QR Code
                </Button>
              </div>
              {qrCodeData.pairingCode && <div className="text-center">
                <p className="text-sm font-medium">Código de Pareamento:</p>
                <p className="text-lg sm:text-xl font-mono font-bold text-primary">{qrCodeData.pairingCode}</p>
              </div>}
              {qrCodeData.code && <div className="text-center"></div>}
            </div>}
            <Card className="bg-muted/50">
              <CardContent className="p-3 sm:p-4">
                <h4 className="font-medium mb-2 text-sm sm:text-base">Instruções:</h4>
                <ol className="text-xs sm:text-sm text-muted-foreground space-y-1">
                  <li>1. Abra o WhatsApp no seu celular</li>
                  <li>2. Toque em "Aparelhos conectados"</li>
                  <li>3. Toque em "Conectar um aparelho"</li>
                  <li>4. Escaneie o QR Code acima</li>
                </ol>
              </CardContent>
            </Card>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setQrModalOpen(false)} className="text-sm">
                Fechar
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
    <Dialog open={iaModalOpen} onOpenChange={setIaModalOpen}>
      <DialogContent className="mx-4">
        <DialogHeader>
          <DialogTitle>Atribuir IA</DialogTitle>
          <DialogDescription>
            Selecione uma IA para atribuir à conexão "{selectedConnection?.nome_api}"
          </DialogDescription>
        </DialogHeader>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg sm:text-xl">Atribuir IA</CardTitle>
            <CardDescription className="text-sm">
              Selecione uma IA para atribuir à conexão "{selectedConnection?.nome_api}"
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">IA Disponível:</label>
              <Select value={selectedIA} onValueChange={setSelectedIA}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma IA..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma IA (desatribuir)</SelectItem>
                  {availableIAs.map(ia => <SelectItem key={ia.id} value={ia.id}>
                    {ia.nome} - {ia.personalidade}
                  </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2">
              <Button variant="outline" onClick={() => setIaModalOpen(false)} className="text-sm">
                Cancelar
              </Button>
              <Button onClick={handleSaveIA} className="text-sm">
                Salvar
              </Button>
            </div>
          </CardContent>
        </Card>
      </DialogContent>
    </Dialog>
  </div>;
}

export default function Conexoes() {
  return <AppLayout>
    <ConexoesContent />
  </AppLayout>;
}
