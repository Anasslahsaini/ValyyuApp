import { Redirect } from 'expo-router';
import { useGate } from '../src/navigation/gate';

export default function Index() {
  const { signedIn, onboarded } = useGate();
  return <Redirect href={!signedIn ? '/welcome' : onboarded ? '/today' : '/start'} />;
}
