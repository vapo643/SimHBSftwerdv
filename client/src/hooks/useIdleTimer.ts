import { useEffect, useRef, useCallback } from 'react';

interface UseIdleTimerOptions {
  timeout: number; // Timeout em milissegundos
  onIdle: () => void; // Callback quando usuário fica inativo
  events?: string[]; // Eventos a monitorar
  throttle?: number; // Throttle para eventos em ms
}

const DEFAULT_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click',
  'wheel'
];

export function useIdleTimer({
  timeout,
  onIdle,
  events = DEFAULT_EVENTS,
  throttle = 500
}: UseIdleTimerOptions) {
  const timeoutId = useRef<NodeJS.Timeout | null>(null);
  const lastEventTime = useRef<number>(Date.now());
  const isIdle = useRef<boolean>(false);

  // Função para resetar o timer
  const resetTimer = useCallback(() => {
    const now = Date.now();
    
    // Throttle: só processa se passou o tempo mínimo desde o último evento
    if (now - lastEventTime.current < throttle) {
      return;
    }
    
    lastEventTime.current = now;
    isIdle.current = false;

    // Limpa o timeout anterior
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
    }

    // Define novo timeout
    timeoutId.current = setTimeout(() => {
      if (!isIdle.current) {
        isIdle.current = true;
        console.log('🕐 [IDLE TIMER] User became idle after 30 minutes of inactivity');
        onIdle();
      }
    }, timeout);
  }, [timeout, onIdle, throttle]);

  // Função para parar o timer
  const stopTimer = useCallback(() => {
    if (timeoutId.current) {
      clearTimeout(timeoutId.current);
      timeoutId.current = null;
    }
    isIdle.current = false;
  }, []);

  // Função para iniciar o timer manualmente
  const startTimer = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  useEffect(() => {
    // Handler de eventos throttled
    let lastCall = 0;
    const throttledHandler = () => {
      const now = Date.now();
      if (now - lastCall >= throttle) {
        lastCall = now;
        resetTimer();
      }
    };

    // Adiciona event listeners
    events.forEach(event => {
      document.addEventListener(event, throttledHandler, true);
    });

    // Inicia o timer
    resetTimer();

    // Cleanup
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, throttledHandler, true);
      });
      stopTimer();
    };
  }, [events, resetTimer, stopTimer, throttle]);

  // Detecta mudanças de tab/foco
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Usuário voltou para a tab, reseta o timer
        resetTimer();
      } else {
        // Usuário saiu da tab, para o timer (opcional)
        // Mantemos o timer rodando para que a inatividade seja contada
        console.log('🔍 [IDLE TIMER] Tab became hidden, timer continues');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [resetTimer]);

  return {
    isIdle: isIdle.current,
    resetTimer,
    stopTimer,
    startTimer
  };
}