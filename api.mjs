import { encode, decode } from '@msgpack/msgpack'

export const version = '1'

export const d13 = 10 * 1000 * 1000 * 1000 * 1000
export const d14 = d13 * 10

export const interdits = '< > : " / \\ | ? *'
// eslint-disable-next-line no-control-regex
export const regInt = /[<>:"/\\|?*\x00-\x1F]/
// eslint-disable-next-line no-control-regex
export const regIntg = /[<>:"/\\|?*\x00-\x1F]/g
// eslint-disable-next-line no-control-regex
export const regInt2g = /[\u{0180}-\u{10FFFF}]/gu

export const limitesjour = { 
  dlv: 365, // résiliation automatique d'un compte non accédé
  margedlv: 30, // marge de purge des versions des comptes non accédés
  notetemp: 60, // durée de vie d'une note temporaire
  sponsoring: 14, // durée de vie d'un sponsoring
  groupenonheb: 120 // durée de vie d'un groupe non hébbergé
}

export function nomFichier (v) {
  if (!v) return ''
  return v.trim().replace(regIntg, '_').replace(regInt2g, '')
}

export const lcSynt = ['q1', 'q2', 'a1', 'a2', 'v1', 'v2', 'ntr1', 'ntr2', 'nbc', 'nbsp', 'nco1', 'nco2']

export class ID {
  /* Retourne l'id COURT depuis une id, longue ou courte, string ou number */
  static court (long) {
    if (!long) return 0
    const x = typeof long === 'string' ? parseInt(long) : long
    return x % d14
  }

  /* Retourne l'id LONG depuis,
  - un ns,
  - une id, longue ou courte, string ou number
  */
  static long (court, ns) { 
    return (ns * d14) + ID.court(court)
  }

  static estComptable (id) { return id % d13 === 0 }

  static estGroupe (id) { return Math.floor(id / d13) % 10 === 3 }

  static estTribu (id) { return Math.floor(id / d13) % 10 === 0 }

  static estAvatar (id) { return Math.floor(id / d13) % 10 < 3 }

  static ns (id) { return Math.floor(id / d14)}
}

export const UNITEV1 = 250000
export const UNITEV2 = 25000000
export const PINGTO = 60 // en secondes. valeur élevée en test

export const E_BRK = 1000 // Interruption volontaire de l'opération
export const E_WS = 2000 // Toutes erreurs de réseau
export const E_DB = 3000 // Toutes erreurs d'accès à la base locale
export const E_BRO = 4000 // Erreur inattendue trappée sur le browser
export const F_BRO = 5000 // Erreur fonctionnelle trappée sur le browser
export const A_BRO = 6000 // Situation inattendue : assertion trappée par le browser
export const E_SRV = 7000 // Erreur inattendue trappée sur le serveur
export const F_SRV = 8000 // Erreur fonctionnelle trappée sur le serveur
export const A_SRV = 9000 // Situation inattendue : assertion trappée sur le serveur

export class AppExc {
  constructor (majeur, mineur, args, stack) {
    this.name = 'AppExc'
    this.code = majeur + (mineur || 0)
    if (args) { this.args = args; this.message = JSON.stringify(args) }
    else { this.args = []; this.message = '???'}
    if (stack) this.stack = stack
  }

  get majeur () { return Math.floor(this.code / 1000) }

  toString () {
    return JSON.stringify(this)
  }
}

export function isAppExc (e) {
  return e && (typeof e === 'object') && (e.name === 'AppExc')
}

export function appexc (e, n) {
  if (isAppExc(e)) return e
  const m = e && e.message ? e.message : '???'
  const s = e && e.stack ? e.stack : ''
  return new AppExc(E_BRO, n || 0, [m], s)
}

/* Une "amj" est un entier de la forme aaaammjj qui indique "un jour"
Le problème est que le même jour 2024-04-01 ne correspond pas un même instant,
- en "local à Tokyo"
- en "local à Paris"
- en UTC.
Ainsi "maintenant" doit être spécifié amjUtc() ou amjLoc() pour obtenir une amj :
- les valeurs seront différentes entre 0 et 2h du matin (UTC passe plus "tard" au jour suivant)

Une "amj" peut être interprtée comme Loc (locale) ou Utc, ce qu'il faut spécifier 
quand on l'utilise pour signifier un instant.
*/
export class AMJ {
  static get nbjm () { return [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] }

  // Dernier jour du mois M de l'année A
  static djm (a, m) { return (m === 2) && (a % 4 === 0) ? AMJ.nbjm[m] + 1 : AMJ.nbjm[m] }
  
  static zp (n) { return n > 9 ? '' + n: '0' + n }

  /* Retourne [a, m, j] depuis une amj */
  static aaaa (amj) { return Math.round(amj / 10000) }

  static mm (amj) { return Math.round((amj % 10000) / 100) }

  static jj (amj) { return amj % 100 }

  static aaaammjj (amj) { return [AMJ.aaaa(amj), AMJ.mm(amj), AMJ.jj(amj)] }
  
  /* Edite une amj avec des - séparateurs */
  static editDeAmj (amj, jma) { 
    if (!amj) return '?'
    const [a, m, j] = AMJ.aaaammjj(amj)
    return !jma ? ('' + a + '-' + AMJ.zp(m) + '-' + AMJ.zp(j)) :
      ('' + j + '/' + m + '/' + a)
  }
  
  /* Retourne une amj depuis une forme éditée 'aaaa-mm-jj' */
  static amjDeEdit (edit) { 
    const [a, m, j] = [ parseInt(edit.substring(0,4)), parseInt(edit.substring(5,7)), parseInt(edit.substring(8)) ]
    return (a * 10000) + (m * 100) + j
  }

  // epoch d'une amj représentant un jour local
  static tDeAmjLoc (amj) { const [a, m ,j] = AMJ.aaaammjj(amj); return new Date(a, m - 1, j).getTime() }
  
  // epoch d'une amj représentant un jour utc
  static tDeAmjUtc (amj) { const [a, m ,j] = AMJ.aaaammjj(amj); return Date.UTC(a, m - 1, j) }

  // Retourne l'amj locale d'une epoch
  static amjLocDeT (t) {
    const d = new Date(t); const [a, m, j] = [d.getFullYear(), d.getMonth() + 1, d.getDate()]
    return (a * 10000) + (m * 100) + j
  }

  // Retourne l'amj utc d'une epoch
  static amjUtcDeT (t) {
    const d = new Date(t); const [a, m, j] = [d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()]
    return (a * 10000) + (m * 100) + j
  }

  // amj du jour actuel "local"
  static amjLoc () { return AMJ.amjLocDeT( Date.now() )}

  // amj du jour actuel "utc"
  static amjUtc () { return AMJ.amjUtcDeT( Date.now() )}

  // jour de la semaine de 1 (Lu) à 7 (Di) d'une amj locale
  static jDeAmjLoc (amj) { const d = new Date(AMJ.tDeAmjLoc(amj)); const j = d.getDay(); return j === 0 ? 7 : j }

  // jour de la semaine de 1 (Lu) à 7 (Di) d'une amj utc
  static jDeAmjUtc (amj) { const d = new Date(AMJ.tDeAmjUtc(amj)); const j = d.getDay(); return j === 0 ? 7 : j }

  // Retourne le nombre de jours entre 2 amj
  static diff (amj1, amj2) { return (AMJ.tDeAmjUtc(amj1) - AMJ.tDeAmjUtc(amj2)) / 86400000 }

  // Retourne l'amj + N jours (locale) de celle passée en argument
  static amjUtcPlusNbj(amj, nbj) {
    const d = new Date(AMJ.tDeAmjUtc(amj))
    return AMJ.amjUtcDeT(d.getTime() + (nbj * 86400000)) // OK parce que UTC
    // d.setDate(d.getDate() + nbj)
    // return AMJ.amjUtcDeT(d.getTime())
  }

  // Retourne l'amj + N jours (utc) de celle passée en argument
  static amjLocPlusNbj(amj, nbj) {
    const d = new Date(AMJ.tDeAmjLoc(amj))
    d.setDate(d.getDate() + nbj)
    return AMJ.amjLocDeT(d.getTime())
  }

  // Retourne l'amj de l'amj passée en argument + 1 mois (en restant dans les jours acceptables)
  static plusUnMois (amj) {
    const [a, m, j] = AMJ.aaaammjj(amj)
    if (m === 12) return ((a + 1) * 10000) + 100 + j
    const jm = AMJ.djm(a, m + 1)
    return (a * 10000) + ((m + 1) * 100) + (j < jm ? j : jm)
  }

  // Retourne l'amj de l'amj passée en argument - 1 mois (en restant dans les jours acceptables)
  static moinsUnMois (amj) {
    const [a, m, j] = AMJ.aaaammjj(amj)
    if (m === 1) return ((a - 1) * 10000) + 1200 + j
    const jm = AMJ.djm(a, m - 1)
    return (a * 10000) + ((m - 1) * 100) + (j < jm ? j : jm)
  }

  // Retourne l'amj du dernier jour du mois de celle passée en argument
  static djMois (amj) {
    const [a, m, ] = AMJ.aaaammjj(amj)
    return (a * 10000) + (m * 100) + AMJ.djm(a, m)
  }

  // Retourne l'amj du dernier jour du mois de celle passée en argument
  static pjMois (amj) {
    const [a, m, ] = AMJ.aaaammjj(amj)
    return (a * 10000) + (m * 100) + 1
  }

  // Retourne l'amj du dernier jour du mois de celle passée en argument
  static djMoisPrec (amj) {
    const [a, m, ] = AMJ.aaaammjj(amj)
    const [ap, mp] = m === 1 ? [a - 1, 12] : [a, m - 1]
    return (ap * 10000) + (mp * 100) + AMJ.djm(ap, mp)
  }

  // Retourne l'amj du dernier jour du mois de celle passée en argument
  static pjMoisSuiv (amj) {
    const [a, m, ] = AMJ.aaaammjj(amj)
    const [ap, mp] = m === 12 ? [a + 1, 1] : [a, m + 1]
    return (ap * 10000) + (mp * 100) + 1
  }

  // Retourne l'amj du dernier jour du mois de celle passée en argument
  static djAnnee (amj) {
    const [a, , ] = AMJ.aaaammjj(amj)
    return (a * 10000) + 1200 + 31
  }

  // Retourne l'amj du dernier jour du mois de celle passée en argument
  static pjAnnee (amj) {
    const [a, , ] = AMJ.aaaammjj(amj)
    return (a * 10000) + 100 + 1
  }

  // Retourne l'amj du dernier jour du mois de celle passée en argument
  static djAnneePrec (amj) {
    const [a, , ] = AMJ.aaaammjj(amj)
    return ((a - 1) * 10000) + 1200 + 31
  }

  // Retourne l'amj du dernier jour du mois de celle passée en argument
  static pjAnneeSuiv (amj) {
    const [a, , ] = AMJ.aaaammjj(amj)
    return ((a + 1) * 10000) + 100 + 1
  }
  
  static am(t) { // retourne [aaaa, mm] d'une epoch
    const d = new Date(t); return [d.getUTCFullYear(), d.getUTCMonth() + 1]
  }

  static t0avap (t) { // t0 du début du mois, nombre de ms du début du mois à t, de t à la fin du mois
    const [a, m] = AMJ.am(t)
    const t0 = new Date(a, m - 1, 1).getTime() // t0 du début du mois
    const t1 = new Date(t === 12 ? a + 1 : a, t === 12 ? m : 0) // t1 du premier du mois suivant
    return [t0, t - t0, t1 - t]
  }
}

export function edvol (vol, u) {
  const v = vol || 0
  if (v < 1000) return v + (u || 'o')
  if (v < 1000000) return (v / 1000).toPrecision(3) + 'K' + (u || 'o')
  if (v < 1000000000) return (v / 1000000).toPrecision(3) + 'M' + (u || 'o')
  if (v < 1000000000000) return (v / 1000000000).toPrecision(3) + 'G' + (u || 'o')
  if (v < 1000000000000000) return (v / 1000000000000).toPrecision(3) + 'T' + (u || 'o')
  return (v / 1000000000000000).toPrecision(3) + 'P' + (u || 'o')
}
  
/* Un tarif correspond à,
- `am`: son premier mois d'application. Un tarif s'applique toujours au premier de son mois.
- `cu` : [6] un tableau de 6 coûts unitaires `[u1, u2, ul, ue, um, ud]`
  - `u1`: 365 jours de quota q1 (250 notes / chats)
  - `u2`: 365 jours de quota q2 (100Mo)
  - `ul`: 1 million de lectures
  - `ue`: 1 million d'écritures
  - `um`: 1 GB de transfert montant.
  - `ud`: 1 GB de transfert descendant.
*/
class Tarif {
  static tarifs = [
    { am: 202201, cu: [0.45, 0.10, 80, 200, 15, 15] },
    { am: 202305, cu: [0.45, 0.10, 80, 200, 15, 15] },
    { am: 202309, cu: [0.45, 0.10, 80, 200, 15, 15] }
  ]

  static cu (a, m) {
    const am = (a * 100) + m
    const t = Tarif.tarifs
    if (am < t[0].am) return t[0].cu
    let cu; t.forEach(l => {if (am >= l.am) x = l.cu})
    return cu
  }
}

const MSPARAN = 365 * 86400 * 1000

/* 
Unités:
- T : temps.
- D : nombre de document (note, chat, participations à un groupe).
- B : byte.
- L : lecture d'un document.
- E : écriture d'un document.
- € : unité monétaire.

quotas et dotation `qd` : `{ q1, q2, dot, nn, nc, ng, v2 }`
consommations `conso` : `{ nl, ne, vm, vd }`
- `q1`: quota du nombre total de notes / chats / groupes.
- `q2`: quota du volume des fichiers.
- `dot`: niveau de dotation pour un compte O.
- `nn`: nombre de notes existantes.
- `nc`: nombre de chats existants.
- `ng` : nombre de participations aux groupes existantes.
- `v2`: volume effectif total des fichiers.
- `nl`: nombre absolu de lectures depuis la création du compte.
- `ne`: nombre d'écritures.
- `vm`: volume _montant_ vers le Storage (upload).
- `vd`: volume _descendant_ du Storage (download).
*/
export class Stats {
  static lp = ['dh0', 'dh', 'vmc', 'mdet', 'mm']
  /*
  dh0: date-heure de création
  dh : date-heure courante
  qd: quotas, dotation courants
  vmc : [0..9] - vecteur détaillé du mois en cours
  mdet : [nbmd] - de 0 à 3 vecteurs détaillés pour M-1 M-2 M-3.
  mm : [nbm] - montants monétaires mensuels pour les mois en cours et précèdents

  Pour chaque mois, il y a un **vecteur** de,
  - 6 compteurs, 2_moyennes et 4 cumuls_ qui servent au calcul au montant du mois,
    - 0 : moyenne des valeurs de q1 (D)
    - 1 : moyenne des valeurs de q2 (B)
    - 2 : nb lectures cumulés sur le mois (L),
    - 3 : nb écritures cumulés sur le mois (E),
    - 4 : total des transferts montants (B),
    - 5 : total des transferts descendants (B).
  - 4 compteurs de _moyenne sur le mois_ qui n'ont qu'une utilité statistique documentaire.
    - 6 : nombre moyen de notes existantes.
    - 7 : nombre moyen de chats existants.
    - 8 : nombre moyen de participations aux groupes existantes.
    - 9 : volume moyen effectif total des fichiers stockés.
  */
  constructor (serial, qd, dh) {
    const t = dh || new Date().getTime()
    if (serial) {
      const x = decode(serial)
      Stats.lp.forEach(p => { this[p] = x[p]})
      this.shift(t)
    } else { // création - Les quotas sont initialisés, les consommations et montants monétaires nuls
      this.dh0 = t
      this.dh = t
      this.qd = qd
      this.vmc = new Array(10)
      this.det = []
      this.mm = new Array[1]
    }
  }

  get serial() {
    const x = {}; Stats.lp.forEach(p => { x[p] = this[p]})
    return new Uint8Array(encode(x))
  }

  deltam (ac, mc, a, m) { // nombre de mois entiers entre [ac, mc] et [a, m]
    let n = 0, ax = ac, mx = mc
    while(m !== mx && a !== ax) { n++; mx++; if (mx === 13) { mx = 1; ax++ } }
    return n
  }

  shift (t) {
    // maj et calcul du mois courant
    const [t0, avx, apx] = AMJ.t0avap(this.dh)
    // Si le mois en cours a commencé après le 1, le nombre de ms AVANT dans le mois est moindre que avx
    const av = this.dh0 > t0 ? (this.dh - this.dh0) : avx 
    // Si l'instant t est dans le même mois que dh, le nombre de ms APRES dans le mois est moindre qua apx
    const ap = t < (t0 + avx + apx) ? (t - this.dh) : apx
    const cu = Tarif.cu(ac, mc)
    const [mm, v] = this.calculMC(av, ap, this.vmc, cu)
    if (t < t0 + ax + ap) {
      // le mois courant n'est pas fini : il a été prolongé, rien d'autre à considérer
      this.vmc = v
      this.mm[0] = mm
      this.dh = t
      return
    }
    // le nouveau mois courant est un autre mois
    // calculer tous les mois manqués
    const [a, m] = AMJ.am(t)
    const [ac, mc] = AMJ.am(this.dh)
    const n = this.deltam(ac, mc, a, m) // nombre de mois à créer et calculer

  

  }

  moy (av, ap, vav, vap) {
    return (vav * (av / (av + ap))) + (vap * (ap / (av + ap)))
  }

  calculMC (av, ap, vmc, cu) { // calcul du mois courant par extension
    const v = new Array(10)
    // Les compteurs de 0 1  et 6 à 9 sont des moyennes (q1, q2, nn, nc, ng, v2), les 4 autres sont des cummuls
    for(let i = 0; i < 10; i++) {
      if (i === 0) { v[i] = this.moy(av, ap, vmc[i], this.qd.q1) }
      else if (i === 1) { v[i] = this.moy(av, ap, vmc[i], this.qd.q2) }
      else if (i === 1) { v[i] = this.moy(av, ap, vmc[i], this.qd.q2) }
      else if (i === 1) { v[i] = this.moy(av, ap, vmc[i], this.qd.nn) }
      else if (i === 1) { v[i] = this.moy(av, ap, vmc[i], this.qd.nc) }
      else if (i === 1) { v[i] = this.moy(av, ap, vmc[i], this.qd.ng) }
      else if (i === 1) { v[i] = this.moy(av, ap, vmc[i], this.qd.v2) }
      else v[i] = vmc[i]
    }
    let m = 0
    // calcul du montant depuis les couts unitaires. Seuls les 6 premiers sont à valoriser
    // les 2 premiers sont à intégrer sur le temps av + ap, leur cu étant annuel
    for(let i = 0; i < 6; i++) {
      if (i <= 1) m += v[i] * cu[i] * ((av + ap) / MSPARAN)
      else m += v[i] * cu[i]
    }
    return [m, v]
  }

  calculNM (a, m) { // calcul d'un nouveau mois
    const v = new Array(10)
    // Les compteurs de 0 1  et 6 à 9 sont des moyennes (q1, q2, nn, nc, ng, v2), les 4 autres sont des cummuls
    for(let i = 0; i < 10; i++) {
      if (i === 0) { v[i] = this.qd.q1 }
      else if (i === 1) { v[i] = this.qd.q2 }
      else if (i === 1) { v[i] = this.qd.nn }
      else if (i === 1) { v[i] = this.qd.nc }
      else if (i === 1) { v[i] = this.qd.ng }
      else if (i === 1) { v[i] = this.qd.v2 }
      else v[i] = 0
    }
    let m = 0
    const nbmsmois = AMJ.djm(a, m) * 86400 *100
    // calcul du montant depuis les couts unitaires. Seuls les 2 premiers sont à valoriser
    // à intégrer sur le nombre de ms du mois, leur cu étant annuel
    for(let i = 0; i < 2; i++) { m += v[i] * cu[i] * (nbmsmois / MSPARAN) }
    return [m, v]
  }

  // Nombre de mois détaillés, de 0 à 3
  get nbmd () { return this.nbm === 1 ? 0 : (this.nbm >= 4 ? 3 : (this.nbm - 1))}
}

