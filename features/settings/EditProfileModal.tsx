
import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
import { auth, storage } from '../../services/firebase';

interface EditProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EditProfileModal: React.FC<EditProfileModalProps> = ({ isOpen, onClose }) => {
  const { currentUser } = useAuth();
  const { addNotification } = useNotification();
  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && currentUser) {
      setName(currentUser.displayName || '');
      setPhotoURL(currentUser.photoURL || '');
    }
  }, [isOpen, currentUser]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    
    // Validação de Tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      addNotification('A imagem deve ter no máximo 5MB.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setUploading(true);
    try {
      const storageRef = storage.ref();
      const fileName = `profile_${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
      const fileRef = storageRef.child(`avatars/${currentUser.uid}/${fileName}`);
      
      // Iniciando upload
      const uploadTask = await fileRef.put(file);
      const url = await uploadTask.ref.getDownloadURL();
      
      setPhotoURL(url);
      addNotification('Foto processada! Clique em salvar para aplicar.', 'success');
    } catch (error: any) {
      console.error("Erro no upload:", error);
      let errorMsg = 'Erro ao enviar a foto. Verifique sua conexão.';
      if (error.code === 'storage/unauthorized') errorMsg = 'Sem permissão para upload. Contate o suporte.';
      
      addNotification(errorMsg, 'error');
    } finally {
      setUploading(false);
      // Limpa o input para permitir selecionar o mesmo arquivo novamente se necessário
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAvatarClick = () => {
    if (!uploading && !loading) {
      fileInputRef.current?.click();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    
    setLoading(true);
    try {
      const firebaseUser = auth.currentUser;
      if (firebaseUser) {
        await firebaseUser.updateProfile({
          displayName: name,
          photoURL: photoURL
        });
        
        addNotification('Perfil atualizado com sucesso!', 'success');
        onClose();
        // Recarregar para garantir que o AuthContext e a UI reflitam a mudança globalmente
        window.location.reload(); 
      } else {
        throw new Error("Usuário não autenticado no Firebase.");
      }
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      addNotification('Erro ao salvar as alterações.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Perfil">
      <div className="mb-8 flex flex-col items-center">
        <div 
          onClick={handleAvatarClick}
          className={`relative group cursor-pointer ${uploading ? 'pointer-events-none' : ''}`}
        >
          <div className={`h-32 w-32 overflow-hidden rounded-full border-4 transition-all duration-300 shadow-xl flex items-center justify-center bg-slate-50
            ${uploading ? 'border-success animate-pulse' : 'border-slate-100 group-hover:border-primary group-hover:scale-[1.02]'}`}
          >
            {uploading ? (
               <div className="flex flex-col items-center gap-2">
                 <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
                 <span className="text-[10px] font-black text-primary uppercase tracking-tighter">Enviando...</span>
               </div>
            ) : (
              <img 
                src={photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                alt="Foto de Perfil" 
                className={`h-full w-full object-cover transition-opacity ${uploading ? 'opacity-30' : 'group-hover:opacity-60'}`}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                }}
              />
            )}
            
            {/* Hover Overlay */}
            {!uploading && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                 <span className="material-symbols-outlined text-white text-4xl">add_a_photo</span>
              </div>
            )}
          </div>
          
          <div className="absolute bottom-1 right-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white shadow-lg border-2 border-white transition-transform group-hover:scale-110">
            <span className="material-symbols-outlined text-xl">camera_alt</span>
          </div>
        </div>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/png, image/jpeg, image/jpg" 
          className="hidden" 
        />
        
        <button 
          type="button" 
          onClick={handleAvatarClick} 
          disabled={uploading}
          className="mt-4 text-xs font-black text-primary hover:underline uppercase tracking-widest disabled:opacity-50"
        >
          {uploading ? 'Processando imagem...' : 'Trocar foto de perfil'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <Input 
          label="Seu nome" 
          placeholder="Como quer ser chamado?" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          icon="person"
          className="rounded-2xl font-bold"
        />

        <div className="rounded-2xl bg-slate-50 p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary text-sm">info</span>
            <p className="text-[10px] font-black text-primary uppercase tracking-widest">Informação</p>
          </div>
          <p className="text-[11px] font-medium text-slate-500 leading-snug">
            Sua foto de perfil ajuda na identificação rápida em extratos e notificações. Use uma imagem clara de até 5MB.
          </p>
        </div>

        <div className="mt-2 flex gap-3">
          <Button 
            type="button" 
            variant="ghost" 
            onClick={onClose} 
            disabled={loading || uploading}
            className="flex-1 rounded-2xl font-bold h-12"
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            isLoading={loading} 
            disabled={uploading || !name.trim()}
            className="flex-1 rounded-2xl font-bold h-12 bg-primary hover:bg-emerald-600 shadow-xl shadow-success/20 text-white"
          >
            Salvar Perfil
          </Button>
        </div>
      </form>
    </Modal>
  );
};
