
import React, { useState, useRef, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useProcessing } from '../../../contexts/ProcessingContext';
import { useNotification } from '../../../contexts/NotificationContext';
import { useAuth } from '../../../contexts/AuthContext';

interface VoiceLaunchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProcessed: () => void;
}

export const VoiceLaunchModal: React.FC<VoiceLaunchModalProps> = ({ isOpen, onClose, onProcessed }) => {
  const { currentUser } = useAuth();
  const { startProcessing } = useProcessing();
  const { addNotification } = useNotification();
  
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [transcript, setTranscript] = useState('');
  const speechRecognitionRef = useRef<any>(null);
  const transcriptRef = useRef('');

  useEffect(() => {
    const w = window as any;
    setSpeechSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));

    let timer: any;
    if (isRecording) {
      timer = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } else {
      setRecordingTime(0);
    }
    return () => clearInterval(timer);
  }, [isRecording]);

  const startRecording = async () => {
    if (!currentUser?.isPro) return;
    if (!speechSupported) {
      addNotification('Seu navegador não suporta reconhecimento de voz.', 'warning');
      return;
    }

    try {
      const w = window as any;
      const SpeechRecognition = w.SpeechRecognition || w.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();

      setTranscript('');
      transcriptRef.current = '';
      recognition.lang = 'pt-BR';
      recognition.interimResults = true;
      recognition.continuous = true;

      recognition.onresult = (event: any) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            finalTranscript += `${event.results[i][0].transcript} `;
          }
        }

        if (finalTranscript.trim()) {
          const nextTranscript = `${transcriptRef.current.trim()} ${finalTranscript.trim()}`.trim();
          transcriptRef.current = nextTranscript;
          setTranscript(nextTranscript);
        }
      };

      recognition.onerror = () => {
        setIsRecording(false);
        addNotification('Falha na captura de voz.', 'error');
      };

      recognition.onend = async () => {
        setIsRecording(false);

        if (transcriptRef.current.trim()) {
          await startProcessing('text', [], transcriptRef.current);
          onProcessed();
        }
      };

      speechRecognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (e) {
      addNotification('Erro ao iniciar reconhecimento de voz.', 'error');
    }
  };

  const stopRecording = () => {
    if (speechRecognitionRef.current && isRecording) {
      speechRecognitionRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Lançamento por Voz">
      <div className="flex flex-col items-center justify-center py-8 gap-8">
        <div className="relative">
          {isRecording && (
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping"></div>
          )}
          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={`relative h-24 w-24 rounded-full flex items-center justify-center transition-all shadow-2xl active:scale-90 ${isRecording ? 'bg-danger text-white' : 'bg-primary text-white'}`}
          >
            <span className="material-symbols-outlined text-4xl">{isRecording ? 'stop' : 'mic'}</span>
          </button>
        </div>
        
        <div className="text-center space-y-2">
            <p className={`text-lg font-black tracking-tight ${isRecording ? 'text-danger animate-pulse' : 'text-slate-800'}`}>
                {isRecording ? `Gravando... ${recordingTime}s` : 'Toque para começar a falar'}
            </p>
            <p className="text-xs font-medium text-slate-400 max-w-[220px] mx-auto leading-relaxed">
              Ex: "Gastei 45 reais no mercado hoje" ou "Recebi o bônus de 500 reais".
            </p>
            {!!transcript.trim() && (
              <p className="text-xs font-bold text-slate-600 max-w-[260px] mx-auto leading-relaxed bg-slate-50 rounded-2xl p-3 border border-slate-100">
                {transcript}
              </p>
            )}
        </div>

        {!isRecording && (
            <Button variant="ghost" onClick={onClose} className="text-slate-400 font-bold text-xs uppercase tracking-widest">
                Cancelar
            </Button>
        )}
      </div>
    </Modal>
  );
};
