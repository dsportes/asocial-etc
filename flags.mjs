export const FLAGS = {
  AC: 1 << 0, // **est _actif_**
  IN: 1 << 1, // **a une invitation en cours**
  AN: 1 << 2, // **a accès aux notes**: un membre _actif_ décide s'il souhaite ou non accéder aux notes (il faut qu'il en ait le _droit_): un non accès allège sa session.
  AM: 1 << 3, // **a accès aux membres**: un membre _actif_ décide s'il souhaite ou non accéder aux autres membres (il faut qu'il en ait le _droit_): un non accès allège sa session.
  DM: 1 << 4, // **droit d'accès à la liste des membres**: s'il est invité s'appliquera quand il sera actif.
  DN: 1 << 5, // **droit d'accès aux notes du groupe**:  s'il est invité s'appliquera quand il sera actif.
  DE: 1 << 6, // **droit d'écriture sur les notes du groupe**: s'il est invité s'appliquera quand il sera actif.
  PA: 1 << 7, // **pouvoir d'animateur du groupe**: s'il est invité s'appliquera quand il sera actif. _Remarque_: un animateur sans droit d'accès aux notes peut déclarer une invitation et être hébergeur.
  HA: 1 << 8, // **a été actif**
  HN: 1 << 9, // **a eu accès aux notes**
  HM: 1 << 10, // **a eu accès aux membres**
  HE: 1 << 11 // **a pu écrire des notes**
}

export const LFLAGS = [
  'est actif',
  'a une invitation en cours',
  'a accès aux notes', 
  'a accès aux membres',
  'a droit d\'accès à la liste des membres',
  'a droit d\'accès aux notes du groupe',
  'a droit d\'écriture sur les notes',
  'a pouvoir d\'animateur',
  'a été actif',
  'a eu accès aux notes',
  'a eu accès aux membres',
  'a pu écrire des notes'
]

// function t (intl) { return intl}

export function edit (n, t) {
  const x = []
  for (let i = 0; i < LFLAGS.length; i++)
    if (n & (1 << i)) x.push(t ? t('FLAGS' + i) : LFLAGS[i])
  return x.join(', ')
}

/*
Ajouter un ou des flags: n |= FLAGS.HA | FLAGS.AC | FLAGS.IN
Enlever un ou des flags: n &= ~FLAGS.AC & ~FLAGS.IN
Toggle un ou des flags: n ^= FLAGS.HE ^ FLAGS.DN
*/
let n = 0
console.log(n.toString(16))

n = n | FLAGS.AC
console.log(n.toString(16), edit(n))

n |= FLAGS.IN
console.log(n.toString(16), edit(n))

n |= FLAGS.HA
console.log(n.toString(16), edit(n))

n = n & ~FLAGS.AC
console.log(n.toString(16), edit(n))

n = 0; n |= FLAGS.HA | FLAGS.AC | FLAGS.IN
console.log(n.toString(16), edit(n))

console.log("a HA et AC = " + (n & FLAGS.HA) && (n & FLAGS.AC))
console.log("a HA et HN=" + (n & FLAGS.HA) && (n & FLAGS.HN))

n &= ~FLAGS.AC & ~FLAGS.IN
n |= FLAGS.HE | FLAGS.HM
console.log(n.toString(16), edit(n))

n ^= FLAGS.HE ^ FLAGS.DN
console.log(n.toString(16), edit(n))

/*
To test if a bit is set:

if ((n & mask) != 0) {
  // bit is set
} else {
  // bit is not set
}

To set a bit:

n |= mask;

To clear a bit:

n &= ~mask;

To toggle a bit:

n ^= mask;
*/