/* Fille ou garçon d'après le prénom.
   Seuls les prénoms connus et sans ambiguïté sont remplis automatiquement ;
   pour tous les autres, on demande au professeur. */
(function () {
  "use strict";
  var F = ("aissatou aminata awa fatoumata kadiatou mariama oumou ramatoulaye binta coumba abigail ada adele adelaide adeline adriana agathe agnes aicha aida alba albane alessia alexandra alexia alia alice alicia aline alisha alissa alizee allison alma amalia amandine amani amanda amaya ambre amel amelia amelie amina amira amy ana anabela anais anastasia andreia angela angelina angelique ania anissa anna annabelle anne annie apolline ariane arielle arwa asma assia assya astrid aude audrey aurelie aurore ava axelle aya ayla aylin barbara beatrice beatriz belinda berenice bethany bianca blanche brenda brigitte britney bruna camelia candice capucine carla carlota carmen carolina caroline cassandra cassandre catarina catherine cecile cecilia celeste celia celina celine chaima chanel chantal charlene charlotte chiara chloe christelle christine cindy claire clara clarisse claudia clea clemence clementine cloe coline colette constance coralie cora corinne cynthia daisy dalia dana daniela danielle daphne debora deborah delphine diana diane dina dounia ece eleanor eleonore elena eliane elina elisa elisabete elisabeth elise eliza ella elle elodie eloise elona elsa elvira ema emilia emilie emma emmanuelle emy enola erica estelle esther eugenie eva evangeline eve evelyne fanny farah fatima fatma fatou fiona flavie flora florence floriane francesca francoise gabriela gabrielle gaelle garance georgia gemma giada ginevra giorgia giulia gloria grace gwenaelle hafsa hajar hana hanae hannah hawa helena helene heloise hermine hiba hind hortense ilana ilona imane imen ines ingrid irene iris isabel isabela isabella isabelle isaline isis ivana jade jana jasmine jeanne jennifer jessica joana joanna johanna josephine joy judith julia juliana julie juliette justine kahina kalia karima karina karla karolina kathleen katia kayla kelly kenza khadija kiara kim kimberly lana lara larissa laura laure lauren laurence laurie layla lea leana leila lena leonie leonor lia liana lila lilas lili lilia lilou lily lina linda lindsay lisa lise livia lola lorena lorine lou louane louisa louise louna luana lucia lucie lucile ludivine luisa luna lya lydia lylou madeleine madison mae maelle maelys mafalda magali maissa malak malia malika manon mara margaux margot maria mariam mariana marie marina marine marion marta martha martina martine maryam maryse mathilde maud maya maylis meline melina melissa melodie melody mia micaela michela michelle mila milena mina mira miriam morgane myriam nada nadia naelle naima najat nala naomi nadege natacha natalia nathalie nawel nayla nelia nelly nina ninon nisrine noelie noelle noemie nora norah nour nora oceane olivia ophelie oriane pamela paola pascale patricia paula pauline penelope perrine petra philippine priscilla rachel rafaela rania raphaelle rebecca romane romy rosa rose rosalie roxane ruth sabine sabrina safa safia safiya salma salome samia samira sana sandra sara sarah selena selma serena sheila shirley sibylle sienna silvia simone sirine sofia sonia sophia sophie soraya stella stephanie suzanne sylvie tania tatiana teresa tess tessa thais theresa tiffany tina valentina valentine valeria valerie vanessa vera veronica veronique victoire victoria violette virginie wendy wiam yasmine yasmina yousra yuna zahra zainab zelie zoe zoey zohra").split(" ");
  var M = ("mamadou ousmane ibrahima seydou cheikh abdou boubacar aboubacar souleymane modibo aaron abdel abdallah abdoulaye abel achille adam adem adil adrian adriano adrien ahmed aidan aiden alain alan albert alberto aldo alessandro alessio alex alexander alexandre alexis alfred ali alois alvaro amadou amaury amine amir anas andre andrei andres angelo anis anthony antoine anton antonio armand arnaud arthur augustin aurelien axel ayden ayoub aziz baptiste bastien basile benjamin benoit bernard bilal blaise bogdan boris brahim brandon bruno bryan calvin cameron carlos carlo cedric cesar charles christian christophe christopher clement colin corentin cristiano cyprien cyril cyrille damien daniel dante david denis diego dimitri diogo djibril dorian douglas dylan edgar edouard eduardo elias eliott elliot emile emilio emmanuel enzo eric ernest erwan esteban ethan etienne evan ewan fabien fabio fabrice federico felix fernando filipe florent florian francesco francisco franck francois frederic gabriel gael gaetan gaspard gauthier georges gerard ghislain gianni gilles giovanni giulio gonçalo goncalo gregoire gregory guilherme guillaume gustave hadrien hamza harry hassan hector henri hicham hugo hugues ian ibrahim idris ilan ilian ilyes ilyas imran isaac ismael ivan jack jacques james jason jean jeremie jeremy jerome joachim joao joel johan john jonas jonathan jordan jorge jose joseph joshua josue jules julian julien junior justin karim kais kamel kevin kylian kyllian lamine lars laurent lenny leo leon leonard leonardo leandro liam lilian lionel lohan loic lorenzo louis luc luca lucas lucien ludovic luis lukas luka maceo mael mahdi malik malo manuel marc marcel marco marcus mario marius martin marvin massimo mateo matheo mathias mathis mathieu matteo mattia matthew matthieu maurice max maxence maxime mehdi michael michel miguel mikael milan milo mohamed mohammed mohammad moussa mustapha nabil nael nathan nathanael nicolas nils noam noe noel nolan norbert octave olivier omar oscar otto owen pablo paolo pascal patrick paul paulo pedro philippe pierre quentin rafael raphael raul remi remy renaud rene ricardo richard riccardo robert robin rodrigo romain romeo ronan ruben rui ryan said salim samir samuel sebastien sergio simon soufiane stanislas stefan stephane steven sven sylvain tanguy theo theodore thibault thibaut thierry thomas tiago tim timothee timeo titouan tom tommaso tony tristan ugo ulysse valentin victor vincent virgile walid wassim william xavier yanis yann yannick yassine yasser youssef yohan yusuf yves zakaria zinedine").split(" ");
  // Prénoms portés par des filles comme par des garçons : on demande toujours.
  var BOTH = ("alix andrea ange camille charlie claude dominique eden elia ezra jessy kim loan lou-ann louison maxim morgan nour noa noah sacha sam sasha swann yael yaelle elie alex chris jordan").split(" ");
  // Exceptions sans doute possible malgré la terminaison
  var setF = {}, setM = {}, setB = {};
  F.forEach(function (n) { setF[n] = 1; }); M.forEach(function (n) { setM[n] = 1; }); BOTH.forEach(function (n) { setB[n] = 1; delete setF[n]; delete setM[n]; });
  // « Kim », « Alex », « Noa » sont dans les deux listes ci-dessus : BOTH l'emporte.

  function norm(v) {
    return String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\- ]/g, "").trim();
  }
  function one(n) {
    if (!n) return null;
    if (setB[n]) return { sex: "", sure: false };
    if (setF[n]) return { sex: "F", sure: true };
    if (setM[n]) return { sex: "M", sure: true };
    return null;
  }
  // Suggestion (jamais validée seule) pour un prénom inconnu
  function hint(n) {
    if (/(ette|elle|ine|ia|ie|ee|a|ah)$/.test(n)) return "F";
    if (/(o|us|el|en|an|in|on|ic|ck|im|ir|id|af)$/.test(n)) return "M";
    return "";
  }
  /* Renvoie { sex: "F" | "M" | "", sure: true | false, hint: "F" | "M" | "" } */
  function guess(first) {
    var full = norm(first);
    if (!full) return { sex: "", sure: false, hint: "" };
    var whole = one(full.replace(/\s+/g, "-"));
    if (whole) return { sex: whole.sex, sure: whole.sure, hint: whole.sex };
    // prénom composé ou plusieurs prénoms : le premier décide (Jean-Paul, Marie-Lou)
    var parts = full.split(/[\s-]+/).filter(Boolean);
    var r = one(parts[0]);
    if (r && r.sure) return { sex: r.sex, sure: true, hint: r.sex };
    if (r) return { sex: "", sure: false, hint: "" };
    return { sex: "", sure: false, hint: hint(parts[0]) };
  }
  window.EPSPrenoms = { guess: guess };
})();
