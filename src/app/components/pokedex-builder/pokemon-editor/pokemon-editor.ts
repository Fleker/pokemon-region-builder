import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RegionStateService } from '../../../services/region-state.service';
import { PokemonDataService } from '../../../services/pokemon-data.service';
import { ModalComponent } from '../../shared/modal/modal';
import {
  CustomPokemon, CustomMove, CustomAbility,
  POKEMON_TYPES, TYPE_COLORS, generateId, StatBlock,
} from '../../../models/pokemon.model';

@Component({
  selector: 'app-pokemon-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ModalComponent],
  templateUrl: './pokemon-editor.html',
  styleUrl: './pokemon-editor.css',
})
export class PokemonEditorComponent {
  state = inject(RegionStateService);
  pokeData = inject(PokemonDataService);

  readonly types = POKEMON_TYPES;
  readonly typeColors = TYPE_COLORS;

  showEditor = signal(false);
  editTarget = signal<string | null>(null); // custom pokemon id being edited

  // Form state
  name = signal('');
  description = signal('');
  type1 = signal('normal');
  type2 = signal<string | null>(null);
  height = signal(1.0);
  weight = signal(10.0);
  spriteDataUrl = signal<string | null>(null);
  isRegionalForm = signal(false);
  baseFormQuery = signal('');

  stats = signal<StatBlock>({ hp: 50, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 });

  moves = signal<string[]>([]); // move ids/names
  abilities = signal<string[]>([]);

  moveInput = signal('');
  abilityInput = signal('');

  // For new move/ability creation
  showMoveEditor = signal(false);
  showAbilityEditor = signal(false);
  newMove = signal<Partial<CustomMove>>({ name: '', type: 'normal', category: 'physical', power: null, accuracy: 100, pp: 10, description: '' });
  newAbility = signal<Partial<CustomAbility>>({ name: '', description: '' });

  customPokemon = computed(() => this.state.customPokemon());
  customMoves = computed(() => this.state.customMoves());
  customAbilities = computed(() => this.state.customAbilities());

  openNew() {
    this.editTarget.set(null);
    this.resetForm();
    this.showEditor.set(true);
  }

  openEdit(id: string) {
    const cp = this.state.customPokemon().find(p => p.id === id);
    if (!cp) return;
    this.editTarget.set(id);
    this.name.set(cp.name);
    this.description.set(cp.description ?? '');
    this.type1.set(cp.types[0]);
    this.type2.set(cp.types[1]);
    this.height.set(cp.height);
    this.weight.set(cp.weight);
    this.spriteDataUrl.set(cp.spriteDataUrl);
    this.isRegionalForm.set(cp.isRegionalForm);
    this.stats.set({ ...cp.stats });
    this.moves.set([...cp.moves]);
    this.abilities.set([...cp.abilities]);
    this.showEditor.set(true);
  }

  private resetForm() {
    this.name.set('');
    this.description.set('');
    this.type1.set('normal');
    this.type2.set(null);
    this.height.set(1.0);
    this.weight.set(10.0);
    this.spriteDataUrl.set(null);
    this.isRegionalForm.set(false);
    this.stats.set({ hp: 50, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50 });
    this.moves.set([]);
    this.abilities.set([]);
  }

  uploadSprite() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => this.spriteDataUrl.set(e.target?.result as string ?? null);
      reader.readAsDataURL(file);
    };
    input.click();
  }

  setStat(key: keyof StatBlock, val: number) {
    this.stats.update(s => ({ ...s, [key]: Math.min(255, Math.max(1, val)) }));
  }

  addMove() {
    const m = this.moveInput().trim();
    if (m && !this.moves().includes(m)) {
      this.moves.update(list => [...list, m]);
      this.moveInput.set('');
    }
  }

  removeMove(m: string) {
    this.moves.update(list => list.filter(x => x !== m));
  }

  addAbility() {
    const a = this.abilityInput().trim();
    if (a && !this.abilities().includes(a)) {
      this.abilities.update(list => [...list, a]);
      this.abilityInput.set('');
    }
  }

  removeAbility(a: string) {
    this.abilities.update(list => list.filter(x => x !== a));
  }

  saveCustomMove() {
    const m = this.newMove();
    if (!m.name?.trim()) return;
    const move: CustomMove = {
      id: generateId(),
      name: m.name.trim(),
      type: m.type ?? 'normal',
      category: m.category ?? 'physical',
      power: m.power ?? null,
      accuracy: m.accuracy ?? null,
      pp: m.pp ?? 10,
      description: m.description ?? '',
    };
    this.state.addCustomMove(move);
    this.moves.update(list => [...list, move.id]);
    this.newMove.set({ name: '', type: 'normal', category: 'physical', power: null, accuracy: 100, pp: 10, description: '' });
    this.showMoveEditor.set(false);
  }

  saveCustomAbility() {
    const a = this.newAbility();
    if (!a.name?.trim()) return;
    const ability: CustomAbility = {
      id: generateId(),
      name: a.name.trim(),
      description: a.description ?? '',
    };
    this.state.addCustomAbility(ability);
    this.abilities.update(list => [...list, ability.id]);
    this.newAbility.set({ name: '', description: '' });
    this.showAbilityEditor.set(false);
  }

  save() {
    const n = this.name().trim();
    if (!n) return;

    const cp: CustomPokemon = {
      id: this.editTarget() ?? generateId(),
      name: n,
      description: this.description().trim(),
      types: [this.type1(), this.type2()],
      height: this.height(),
      weight: this.weight(),
      stats: this.stats(),
      moves: this.moves(),
      abilities: this.abilities(),
      spriteDataUrl: this.spriteDataUrl(),
      isRegionalForm: this.isRegionalForm(),
      baseFormId: null,
    };

    if (this.editTarget()) {
      this.state.updateCustomPokemon(cp.id, cp);
    } else {
      this.state.addCustomPokemon(cp);
      // Also add to dex
      this.state.addDexEntry(cp.id, true, this.isRegionalForm(), null, [this.type1(), ...(this.type2() ? [this.type2()!] : [])]);
    }

    this.showEditor.set(false);
  }

  deleteCustom(id: string) {
    if (confirm('Delete this custom Pokémon?')) {
      this.state.removeCustomPokemon(id);
      this.state.removeDexEntry(id);
    }
  }

  typeColor(t: string): string {
    return this.typeColors[t] ?? '#888';
  }

  statKeys: (keyof StatBlock)[] = ['hp', 'attack', 'defense', 'spAttack', 'spDefense', 'speed'];
  statLabels: Record<keyof StatBlock, string> = {
    hp: 'HP', attack: 'Atk', defense: 'Def',
    spAttack: 'Sp.Atk', spDefense: 'Sp.Def', speed: 'Spd',
  };

  getMoveName(id: string): string {
    const cm = this.state.customMoves().find(m => m.id === id);
    return cm ? cm.name : id;
  }

  getAbilityName(id: string): string {
    const ca = this.state.customAbilities().find(a => a.id === id);
    return ca ? ca.name : id;
  }

  statTotal = computed(() => {
    const s = this.stats();
    return s.hp + s.attack + s.defense + s.spAttack + s.spDefense + s.speed;
  });
}
