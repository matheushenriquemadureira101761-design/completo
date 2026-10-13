import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Roda `fn` quando a pessoa volta para o app (ex.: depois de pagar o Pix no banco). */
export function useAoVoltarProApp(fn) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const s = AppState.addEventListener('change', (estado) => { if (estado === 'active') ref.current(); });
    return () => s.remove();
  }, []);
}

export { dataCurta, extrairCodigo } from '../lib/util';
