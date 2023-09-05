/* eslint-disable lines-between-class-members */
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
- `cu` : [7] un tableau de 7 coûts unitaires `[dt, u1, u2, ul, ue, um, ud]`
  - 'uc': 365 jours de quota de consommation
  - `u1`: 365 jours de quota q1 (250 notes / chats)
  - `u2`: 365 jours de quota q2 (100Mo)
  - `ul`: 1 million de lectures
  - `ue`: 1 million d'écritures
  - `um`: 1 GB de transfert montant.
  - `ud`: 1 GB de transfert descendant.
*/
class Tarif {
  static tarifs = [
    { am: 202201, cu: [1.5, 0.45, 0.10, 80, 200, 15, 15] },
    { am: 202305, cu: [1.7, 0.45, 0.10, 80, 200, 15, 15] },
    { am: 202309, cu: [1.8, 0.45, 0.10, 80, 200, 15, 15] }
  ]

  static cu (a, m) {
    const am = (a * 100) + m
    const t = Tarif.tarifs
    if (am < t[0].am) return t[0].cu
    let cu; t.forEach(l => {if (am >= l.am) cu = l.cu})
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

quotas et volumes `qv` : `[ qc, q1, q2, nn, nc, ng, v2 ]`
consommations `conso` : `{ nl, ne, vm, vd }`
- `qc`: quota de consommation
- `q1`: quota du nombre total de notes / chats / groupes.
- `q2`: quota du volume des fichiers.
- `nn`: nombre de notes existantes.
- `nc`: nombre de chats existants.
- `ng` : nombre de participations aux groupes existantes.
- `v2`: volume effectif total des fichiers.
- `nl`: nombre absolu de lectures depuis la création du compte.
- `ne`: nombre d'écritures.
- `vm`: volume _montant_ vers le Storage (upload).
- `vd`: volume _descendant_ du Storage (download).
*/
export class Fact {
  static NHD = 4 // nombre de mois d'historique détaillé (dont le mois en cours)
  static NHM = 18 // nombre de mois d'historique des montants des coûts (dont le mois en cours)

  static X1 = 3 // nombre de compteurs de quotas
  static X2 = 4 // nombre de compteurs de consommation
  static X3 = 3 // nombre de compteurs techniques dans un vecteur détaillé

  static QC = 0 // quota de consommation
  static Q1 = 1 // quota du nombre total de notes / chats / groupes.
  static Q2 = 2 // quota du volume des fichiers.
  static NN = 3 // nombre de notes existantes.
  static NC = 4 // nombre de chats existants.
  static NG = 5 // nombre de participations aux groupes existantes.
  static V2 = 6 // volume effectif total des fichiers.
  static NCO = 4 // nombre de compteurs de consommation
  static NL = 0 // nombre absolu de lectures depuis la création du compte.
  static NE = 1 // nombre d'écritures.
  static VM = 2 // volume _montant_ vers le Storage (upload).
  static VD = 3 // volume _descendant_ du Storage (download).
  static MS = Fact.X1 + Fact.X2 // nombre de ms dans le mois - si 0, le compte n'était pas créé
  static CA = Fact.X1 + Fact.X2 + 1 // coût de l'abonnment pour le mois
  static CC = Fact.X1 + Fact.X2 + 2 // coût de la consommation pour le mois

  static NBCD = Fact.X1 + (2 * Fact.X2) + Fact.X3

  static lp = ['dh0', 'dh', 'qv', 'vd', 'mm', 'aboma', 'consoma']

  /*
  dh0 : date-heure de création du compte
  dh : date-heure courante
  qv : quotas et volumes courants `{ qc, q1, q2, nn, nc, ng, v2 }`
  vd : [0..3] - vecteurs détaillés pour M M-1 M-2 M-3.
  mm : [0..18] - coût abo + conso pour le mois M et les 17 mois antérieurs (si 0 pour un mois, le compte n'était pas créé)
  aboma : somme des coûts d'abonnement des mois antérieurs depuis la création du compte
  consoma : somme des coûts consommation des mois antérieurs depuis la création du compte

  Pour chaque mois M à M-3, il y a un **vecteur** de 14 (X1 + X2 + X2 + 3) compteurs:
  - X1_moyennes et X2 cumuls servent au calcul au montant du mois
    - QC : moyenne de qc dans le mois (€)
    - Q1 : moyenne de q1 dans le mois (D)
    - Q2 : moyenne de q2 dans le mois (B)
    - X1 + NL : nb lectures cumulés sur le mois (L),
    - X1 + NE : nb écritures cumulés sur le mois (E),
    - X1 + VM : total des transferts montants (B),
    - X1 + VD : total des transferts descendants (B).
  - X2 compteurs de _consommation moyenne sur le mois_ qui n'ont qu'une utilité documentaire.
    - X2 + NN : nombre moyen de notes existantes.
    - X2 + NC : nombre moyen de chats existants.
    - X2 + NG : nombre moyen de participations aux groupes existantes.
    - X2 + V2 : volume moyen effectif total des fichiers stockés.
  - 3 compteurs spéciaux
    - MS : nombre de ms dans le mois - si 0, le compte n'était pas créé
    - CA : coût de l'abonnement pour le mois
    - CC : coût de la consommation pour le mois
  */

  constructor (serial, qv, dh) {
    const t = dh || new Date().getTime()
    if (serial) {
      const x = decode(serial)
      Fact.lp.forEach(p => { this[p] = x[p]})
      this.shift(t)
      if (qv) this.qv = qv // valeurs de quotas / volumes à partir de maintenant
    } else { // création - Les quotas sont initialisés, les consommations et montants monétaires nuls
      this.dh0 = t
      this.dh = t
      this.qv = qv
      this.vd = new Array(Fact.NHD)
      for(let i = 0; i < Fact.NHD; i++) this.vd[i] = new Array(Fact.NBCD).fill(0)
      this.mm = new Array[Fact.NHM].fill(0)
      this.aboma = 0
      this.consoma = 0
    }
  }

  get serial() {
    const x = {}; Fact.lp.forEach(p => { x[p] = this[p]})
    return new Uint8Array(encode(x))
  }

  // Méthodes privées
  deltam (ac, mc, a, m) { // nombre de mois entiers entre l'ancien mois courant [ac, mc] et le futur [a, m]
    let n = 0, ax = ac, mx = mc
    while(m !== mx && a !== ax) { n++; mx++; if (mx === 13) { mx = 1; ax++ } }
    return n
  }

  shift (t) {
    const [t0, avx, apx] = AMJ.t0avap(this.dh)
    if (t < t0 + avx + apx) {
      // le mois courant n'est pas fini : il est prolongé.
      const ap = t - this.dh // ap : temps restant entre dh et t
      // Si l'instant t est dans le mois de création, le nombre de ms AVANT dans le mois est moindre qua avx
      const av = this.dh0 > t0 ? (this.dh - this.dh0) : avx 
      const v = this.calculMC(av, ap, this.vd[0], Tarif.cu(ac, mc))  
      this.mm[0] = v[Fact.CA] + v[Fact.CC] // le cout total du mois courant a changé
      this.vd[0] = v // le détail du mois courant a changé
      this.dh = t // la date-heure du dernier calcul a changé
      return
    }
    // le nouveau mois courant est un autre mois
    // on calcule les mois manquants entre l'ancien courant et le mois actuel
    const [a, m] = AMJ.am(t)
    const [ac, mc] = AMJ.am(this.dh)
    const n = this.deltam(ac, mc, a, m) // nombre de mois à créer et calculer (au moins 1, le futur courant)
    // init de la structure temporaire vd / mm
    const _vd = new Array(Fact.NHD)
    for(let i = 0; i < Fact.NHD; i++) _vd[i] = new Array(Fact.NBCD).fill(0)
    const _mm = new Array[Fact.NHM].fill(0)

    { 
      // Mois courant "nouveau"
      const [, msmois, ] = AMJ.t0avap(t) // nb de ms AVANT t
      const v = this.calculNM (a, m, Tarif.cu(a, m), msmois)
      this.crmc = v[2] // le crédit du mois courant a été recalculé
      _mm[0] = v[Fact.CA] + v[Fact.CC] // le cout total du mois courant a changé
      _vd[0] = v // le détail du mois courant a changé
    }

    let ax = a; let mx = m
    for(let i = 1; i < n; i++) {
      // Mois intermédiaires "nouveaux" à créer APRES le courant (créé ci-dessus) 
      // et AVANT l'ancien courant recalculé ci-dessous (qui devient antérieur)
      if (mx === 11) { ax++; mx = 1} else mx++
      const msmois = AMJ.djm(ax, mx) * 86400 *100 // nombre de millisecondes du mois
      const v = this.calculNM (ax, mx, Tarif.cu(ax, mx), msmois)
      this.aboma += v[Fact.CA]
      this.consoma += v[Fact.CC]
      if (i < Fact.NHD) _vd[i] = v
      if (i < Fact.NHM) _mm[i] = v[Fact.CA] + v[Fact.CC] // le cout total du nouveau mois a été calculé
    }

    {
      // Recalcul de "l'ex" mois courant, prolongé jusqu'à sa fin et devenant antérieur
      // si c'était le mois de création, le nombre de ms AVANT n'est pas avx celui depuis le début du mois
      const av = this.dh0 > t0 ? (this.dh - this.dh0) : avx
      const v = this.calculMC(av, apx, this.vd[0], Tarif.cu(ac, mc))
      // le mois "ex" courant est dvenu antérieur
      this.aboma += v[Fact.CA] 
      this.consoma += v[Fact.CC]
      if (n < Fact.NHD) _vd[n] = v
      if (n < Fact.NHM) _mm[n] = v[Fact.CA] + v[Fact.CC] // le cout total de l'ex mois courant a été calculé
    }

    /* completer _vd si nécessaire. On a créé n mois. 
    - ajouter dans _vd les mois antérieurs dans la limite de NHD
    - ajouter dans _mm les mois antérieurs dans la limite de NHM
    */
    let mq = Fact.NHD - n
    if (mq > 0) {
      for(let i = 0; i < mq; i++) _vd[n + i] = this.vd[i]
    }
    mq = Fact.NHM - n
    if (mq > 0) {
      for(let i = 0; i < mq; i++) _mm[n + i] = this.mm[i]
    }
    this.vd = _vd
    this.mm = _mm
  }

  moy (av, ap, vav, vap) {
    return (vav * (av / (av + ap))) + (vap * (ap / (av + ap)))
  }

  calculMC (av, ap, vmc, cu) { // calcul du mois courant par extension
    const v = new Array(Fact.NBCD).fill(0)
    v[Fact.MS] = av + ap // nombre de millisecondes du mois
    // Les X1 premiers compteurs sont des moyennes de quotas
    for(let i = 0; i <= Fact.X1; i++)
      v[i] = this.moy(av, ap, vmc[i], this.qv[i])
    // Les X2 suivants sont des cumuls de consommation
    for(let i = 0; i <= Fact.X2; i++)
      v[i + Fact.X1] = vmc[i + Fact.X1]
    // Les X2 suivants sont des moyennes de consommations
    for(let i = 0; i <= Fact.X2; i++) 
      v[i + Fact.X1 + Fact.X2] = this.moy(av, ap, vmc[i + Fact.X1 + Fact.X2], this.qv[Fact.X1 + i])
    let s = 0
    /* calcul du montant par multiplication par leur cout unitaire.
    - pour les X1 premiers le cu est annuel: on le calcule au prorata des ms du mois / ms d'un an
    */
    for(let i = 0; i <= Fact.X1 + Fact.X2; i++) {
      s += v[i] * cu[i] * (i < Fact.X1 ? (v[Fact.MS] / MSPARAN) : 1)
    }
    v[1] = s
    return v
  }

  calculNM (a, m, cu, msmois) { // calcul d'un nouveau mois
    const v = new Array(Fact.NBCD).fill(0)
    v[Fact.MS] = msmois// nombre de millisecondes du mois
    // Les X1 premiers compteurs sont des moyennes de quotas à initialiser
    for(let i = 0; i <= Fact.X1; i++)
      v[i] = this.qv[i]
    // Les X2 suivants sont des cumuls de consommation à mettre à 0
    for(let i = 0; i <= Fact.X2; i++)
      v[i + Fact.X1] = 0
    // Les X2 suivants sont des moyennes de consommations à initialiser
    for(let i = 0; i <= Fact.X2; i++) 
      v[i + Fact.X1 + Fact.X2] = this.qv[Fact.X1 + i]

    // TODO
    let s = 0
    // calcul du montant depuis les couts unitaires.
    // Seuls 2 3 4 sont à intégrer sur le temps du mois
    for(let i = 2; i <= 4; i++) s += v[i] * cu[i - 2] * (v[0] / MSPARAN)
    v[1] = s
    return v
  }

  // Nombre de mois détaillés, de 0 à 3
  get nbmd () { return this.nbm === 1 ? 0 : (this.nbm >= 4 ? 3 : (this.nbm - 1))}
}

