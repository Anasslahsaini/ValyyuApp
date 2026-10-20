import { Button, Card, ListRow, SegmentedControl, TextField, Text, type ButtonKind } from '@workspace/ui';
import { useState } from 'react';
import { Section } from './Section';

const KINDS: ButtonKind[] = ['primary', 'secondary', 'tertiary', 'decision', 'destructive'];
const noop = () => undefined;

export function ComponentSection() {
  const [view, setView] = useState<'semaine' | 'frigo' | 'courses'>('semaine');
  const [email, setEmail] = useState('');
  return (
    <>
      <Section title="Boutons">
        {KINDS.map((kind) => (
          <Card key={kind}>
            <Text variant="caption" tone="secondary">{`button.${kind}`}</Text>
            <Button kind={kind} label="Continuer" onPress={noop} testID={`button-${kind}-normal`} />
            <Button
              kind={kind}
              label="Continuer"
              onPress={noop}
              disabled
              testID={`button-${kind}-disabled`}
            />
            <Button kind={kind} label="Continuer" onPress={noop} loading testID={`button-${kind}-loading`} />
          </Card>
        ))}
      </Section>
      <Section title="Champs">
        <TextField
          label="Adresse e-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextField
          label="Adresse e-mail"
          value="rayan@"
          onChangeText={noop}
          error="Il manque la fin de l'adresse (ex. : .fr)."
        />
        <TextField label="Taille" value="170" unit="cm" onChangeText={noop} keyboardType="number-pad" />
      </Section>
      <Section title="Contrôle segmenté">
        <SegmentedControl
          accessibilityLabel="Vue des repas"
          value={view}
          onChange={setView}
          options={[
            { value: 'semaine', label: 'Semaine' },
            { value: 'frigo', label: 'Frigo' },
            { value: 'courses', label: 'Courses' },
          ]}
        />
      </Section>
      <Section title="Lignes de liste">
        <ListRow title="Compte" value="rayan@exemple.fr" onPress={noop} />
        <ListRow title="Langue" value="Français" onPress={noop} external />
        <ListRow title="Supprimer mon compte" onPress={noop} destructive />
      </Section>
      <Section title="Cartes">
        <Card>
          <Text>Carte ordinaire (elevation.0)</Text>
        </Card>
        <Card elevated>
          <Text variant="headline">Bol riz, poulet et légumes rôtis</Text>
          <Text tone="secondary">20 min · avec ce qu'il y a dans ton frigo</Text>
          <Button kind="secondary" label="Changer" onPress={noop} />
          <Button kind="decision" label="OK" onPress={noop} />
        </Card>
      </Section>
    </>
  );
}
