import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { icon } from '@workspace/tokens';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import type { ComponentProps } from 'react';

export type IconProps = {
  sf: SFSymbol;
  md: ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  size?: number;
};

/** SF Symbol on iOS, Material icon elsewhere. Decorative: the parent carries the spoken name. */
export function Icon({ sf, md, color, size = icon.md }: IconProps) {
  return (
    <SymbolView
      name={sf}
      tintColor={color}
      size={size}
      fallback={<MaterialIcons name={md} size={size} color={color} />}
    />
  );
}
