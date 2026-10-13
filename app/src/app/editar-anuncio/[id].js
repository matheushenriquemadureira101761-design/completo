import { useLocalSearchParams } from 'expo-router';
import FormularioAnuncio from '../../componentes/FormularioAnuncio';

export default function EditarAnuncio() {
  const { id } = useLocalSearchParams();
  return <FormularioAnuncio anuncioId={String(id)} />;
}
