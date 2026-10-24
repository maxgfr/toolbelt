/**
 * About 200 common words per language for the typing test: lowercase, except German nouns,
 * which keep their capital as they are always written.
 */

export const EN_WORDS =
  `the be to of and a in that have it for not on with he as you do at this but his by from
they we say her she or an will my one all would there their what so up out if about who get which go me
when make can like time no just him know take people into year your good some could them see other than
then now look only come its over think also back after use two how our work first well way even new want
because any these give day most us great old life long world high very public still own last school such
place right group small number hand part large child home water point house read never same tell keep
story fact start city change night play light question run turn move live end begin open help show
those both between under might while where always each every around family state word line need name
much again before door idea form food early off car music letter friend mother father head bring
watch follow stop walk talk learn write hear feel few leave late sure hard easy plan close real green
young half river morning game table pay list best clear simple paper today window cold warm summer`
    .split(/\s+/)
    .filter(Boolean);

export const FR_WORDS =
  `le la les de un une des et est en que qui dans pour pas plus sur avec il elle on nous vous
ils ce cette son sa ses mais par comme tout bien faire être avoir dire aller voir savoir pouvoir vouloir
venir prendre donner mettre trouver parler aimer passer rester penser croire temps jour année fois vie
monde homme femme enfant main tête œil maison ville pays eau terre nuit soir matin heure moment chose
travail école livre porte table chambre route voiture argent ami famille père mère frère sœur nom mot
idée question raison partie place point fin début côté bout lieu cas état groupe histoire guerre amour
grand petit bon nouveau jeune vieux beau premier dernier long haut seul même autre chaque toujours
jamais souvent encore déjà aussi alors après avant ici là où quand comment pourquoi très trop peu
beaucoup vraiment rien personne quelque sans sous entre vers chez depuis pendant contre devant
derrière jardin soleil lune mer ciel arbre fleur chat chien pain lait café sucre musique chanson film
jeu sport ballon rouge bleu vert blanc noir doux fort facile simple vite lent froid chaud lire écrire
ouvrir fermer partir arriver courir marcher manger boire dormir jouer chanter`
    .split(/\s+/)
    .filter(Boolean);

export const DE_WORDS =
  `der die das und in zu den von nicht mit sich des auf für ist im dem ein eine als auch es an
werden aus er hat dass sie nach wird bei einer um am sind noch wie über so zum war haben nur oder aber
vor zur bis mehr durch man sein wurde können schon wenn ich du wir ihr kann sehr hier alle ganz immer
gibt viel heute dann jetzt also doch denn weil ohne gegen unter zwischen während seit wieder etwas
nichts genau nie oft fast bald gern gehen kommen sehen machen sagen wissen geben finden bleiben liegen
stehen nehmen bringen denken laufen fahren lesen schreiben sprechen spielen hören fühlen lernen
arbeiten wohnen essen trinken schlafen öffnen schließen kaufen zählen müssen dürfen möchten heißen
grüßen fließen Zeit Jahr Tag Mensch Kind Frau Mann Hand Haus Welt Leben Stadt Land Wasser Straße
Schule Arbeit Woche Morgen Abend Nacht Freund Familie Mutter Vater Bruder Schwester Name Wort Frage
Antwort Buch Tisch Tür Fenster Auto Geld Musik Spiel Hund Katze Baum Blume Sonne Mond Himmel Meer
Brot Milch Kaffee Zucker Garten Küche Zimmer Bild Farbe Größe Fuß Gruß Mädchen Märchen Brücke Glück
Übung Schlüssel Löffel Vogel Weg Platz Teil Ende Anfang Idee Geschichte groß klein gut neu alt jung
lang kurz hoch tief schön schnell langsam leicht schwer warm kalt heiß weiß schwarz rot blau grün gelb
süß früh spät müde froh fröhlich ruhig laut leise stark weich hart offen richtig falsch wichtig möglich
einfach gemütlich`
    .split(/\s+/)
    .filter(Boolean);
