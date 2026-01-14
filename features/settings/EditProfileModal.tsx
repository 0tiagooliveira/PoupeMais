
import React, { useState, useEffect, useRef } from 'react';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useNotification } from '../../contexts/NotificationContext';
// Import auth and storage services
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
    if (e.target.files && e.target.files[0] && currentUser) {
      const file = e.target.files[0];
      
      // Validação básica (Tamanho < 5MB)
      if (file.size > 5 * 1024 * 1024) {
        addNotification('A imagem deve ter no máximo 5MB.', 'error');
        return;
      }

      setUploading(true);
      try {
        const storageRef = storage.ref();
        // Cria uma referência única para o usuário
        const fileRef = storageRef.child(`avatars/${currentUser.uid}/profile_${Date.now()}`);
        
        await fileRef.put(file);
        const url = await fileRef.getDownloadURL();
        
        setPhotoURL(url);
        addNotification('Foto enviada com sucesso!', 'success');
      } catch (error) {
        console.error("Erro no upload:", error);
        addNotification('Erro ao enviar a foto. Tente novamente.', 'error');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
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
        window.location.reload(); 
      } else {
        throw new Error("Usuário não encontrado.");
      }
    } catch (error) {
      console.error(error);
      addNotification('Erro ao atualizar perfil.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar perfil">
      <div className="mb-6 flex flex-col items-center">
        <div 
          onClick={handleAvatarClick}
          className="relative group cursor-pointer"
        >
          <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-slate-100 p-1 shadow-lg transition-all group-hover:border-primary group-hover:scale-105">
            {uploading ? (
               <div className="h-full w-full flex items-center justify-center bg-slate-100 rounded-full">
                 <span className="material-symbols-outlined animate-spin text-slate-400">progress_activity</span>
               </div>
            ) : (
              <img 
                src={photoURL || 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'} 
                alt="Preview" 
                className="h-full w-full rounded-full object-cover transition-opacity group-hover:opacity-70"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                }}
              />
            )}
            
            {/* Overlay Icon */}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
               <span className="material-symbols-outlined text-white text-3xl font-bold">upload</span>
            </div>
          </div>
          
          <div className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white shadow-md border-2 border-white transition-transform group-hover:scale-110">
            <span className="material-symbols-outlined text-sm font-bold">photo_camera</span>
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
          className="mt-3 text-[11px] font-bold text-primary hover:underline"
        >
          {uploading ? 'Enviando...' : 'Alterar foto'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <Input 
          label="Nome completo" 
          placeholder="Como quer ser chamado?" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          icon="person"
          className="rounded-2xl"
        />

        <Input 
          label="URL da foto (Opcional)" 
          placeholder="Ou cole um link direto aqui" 
          value={photoURL}
          onChange={(e) => setPhotoURL(e.target.value)}
          icon="link"
          className="rounded-2xl"
        />

        <div className="rounded-2xl bg-success/5 p-4 border border-success/10">
          <p className="text-[10px] font-bold text-primary mb-1 leading-tight">Dica</p>
          <p className="text-[11px] font-medium text-slate-600 leading-snug">
            Clique na foto acima para carregar uma imagem do seu dispositivo ou cole um link externo no campo URL.
          </p>
        </div>

        <div className="mt-2 flex gap-3">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 rounded-2xl font-bold h-12">
            Cancelar
          </Button>
          <Button 
            type="submit" 
            isLoading={loading || uploading} 
            disabled={uploading}
            className="flex-1 rounded-2xl font-bold h-12 bg-primary hover:bg-emerald-600 shadow-xl shadow-success/20 text-white"
          >
            Salvar alterações
          </Button>
        </div>
      </form>
    </Modal>
  );
};
