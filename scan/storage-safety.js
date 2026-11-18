(() => {

  const BACKUP_COUNT = 3;

  const BACKUP_PREFIX =
    `${KEY}-auto-backup-`;

  const BACKUP_DATE_PREFIX =
    `${KEY}-auto-backup-date-`;

  const BEFORE_IMPORT_KEY =
    `${KEY}-before-import`;

  const BEFORE_IMPORT_DATE_KEY =
    `${KEY}-before-import-date`;


  /* ========================================
     COPIES DE SECOURS HORS DE localStorage
     (Demi-fond EPS) : sur une adresse partagée comme
     eps-barletta.github.io, les 5 Mo de localStorage sont
     communs à toutes les applis. Les copies de secours
     (3 versions + avant import) vont donc dans IndexedDB,
     seule la base active reste dans localStorage.
  ======================================== */
  const isBackupKey = k =>
    String(k).startsWith(BACKUP_PREFIX) ||
    String(k).startsWith(BEFORE_IMPORT_KEY);

  const backupCache = new Map();
  let backupDB = null;

  function openBackupDB() {
    if (!backupDB) {
      backupDB = new Promise((resolve, reject) => {
        const r = indexedDB.open("df-scan-ccf-backups", 1);
        r.onupgradeneeded = () => r.result.createObjectStore("kv");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }
    return backupDB;
  }
  function idbWrite(k, v) {
    openBackupDB().then(db => {
      const t = db.transaction("kv", "readwrite");
      if (v == null) t.objectStore("kv").delete(k);
      else t.objectStore("kv").put(String(v), k);
    }).catch(() => {});
  }
  // 1. reprise des anciennes copies présentes dans localStorage, puis libération de la place
  try {
    const old = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && isBackupKey(k)) old.push(k);
    }
    old.forEach(k => {
      const v = localStorage.getItem(k);
      backupCache.set(k, v);
      idbWrite(k, v);
      localStorage.removeItem(k);
    });
  } catch (e) {}
  // 2. chargement des copies déjà rangées dans IndexedDB
  openBackupDB().then(db => {
    const st = db.transaction("kv").objectStore("kv");
    const req = st.openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (!c) return;
      if (!backupCache.has(c.key)) backupCache.set(c.key, c.value);
      c.continue();
    };
  }).catch(() => {});

  const bkStore = {
    getItem(k) {
      if (isBackupKey(k)) return backupCache.has(k) ? backupCache.get(k) : null;
      return localStorage.getItem(k);
    },
    setItem(k, v) {
      if (isBackupKey(k)) { backupCache.set(k, String(v)); idbWrite(k, v); return; }
      localStorage.setItem(k, v);
    },
    removeItem(k) {
      if (isBackupKey(k)) { backupCache.delete(k); idbWrite(k, null); return; }
      localStorage.removeItem(k);
    }
  };


  /* ========================================
     OUTILS
  ======================================== */

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }


  function validDatabase(data) {
    return (
      data &&
      typeof data === "object" &&
      Array.isArray(data.groups)
    );
  }


  function studentKey(student) {
    return String(
      student?.externalId ||
      student?.id ||
      `${student?.last || ""}|${student?.first || ""}|${student?.classroom || ""}`
    );
  }


  function safeDate(timestamp) {
    if (!timestamp) {
      return "date inconnue";
    }

    try {
      return new Date(
        Number(timestamp)
      ).toLocaleString(
        "fr-FR"
      );
    } catch {
      return "date inconnue";
    }
  }


  /* ========================================
     ROTATION DES SAUVEGARDES
  ======================================== */

  function rotateBackups(
    currentRaw
  ) {

    if (!currentRaw) {
      return;
    }

    try {

      for (
        let i = BACKUP_COUNT;
        i >= 2;
        i--
      ) {

        const previousRaw =
          bkStore.getItem(
            BACKUP_PREFIX +
            (i - 1)
          );

        const previousDate =
          bkStore.getItem(
            BACKUP_DATE_PREFIX +
            (i - 1)
          );

        if (previousRaw) {
          bkStore.setItem(
            BACKUP_PREFIX + i,
            previousRaw
          );
        }

        if (previousDate) {
          bkStore.setItem(
            BACKUP_DATE_PREFIX + i,
            previousDate
          );
        }
      }


      bkStore.setItem(
        BACKUP_PREFIX + "1",
        currentRaw
      );

      bkStore.setItem(
        BACKUP_DATE_PREFIX + "1",
        String(Date.now())
      );

    } catch (error) {

      console.warn(
        "Sauvegarde automatique impossible :",
        error
      );

    }
  }


  /* ========================================
     NOUVELLE FONCTION SAVE
  ======================================== */

  function secureSave() {

    const nextRaw =
      JSON.stringify(db);

    const currentRaw =
      bkStore.getItem(KEY);


    /*
      On crée une version de secours
      uniquement si la base a réellement changé.
    */

    if (
      currentRaw &&
      currentRaw !== nextRaw
    ) {
      rotateBackups(
        currentRaw
      );
    }


    try {

      bkStore.setItem(
        KEY,
        nextRaw
      );

      bkStore.setItem(
        `${KEY}-last-save`,
        String(Date.now())
      );

    } catch (error) {

      console.error(
        "Erreur sauvegarde locale :",
        error
      );

      alert(
        "Impossible d’enregistrer les données sur cet appareil."
      );
    }
  }


  /* ========================================
     FUSION DES ÉLÈVES
  ======================================== */

  function mergeStudent(
    current,
    incoming
  ) {

    const result = {
      ...clone(incoming),
      ...clone(current)
    };


    result.races = {
      ...(incoming.races || {}),
      ...(current.races || {})
    };


    /*
      Si une information manque dans
      la version actuelle, on récupère
      celle de la sauvegarde.
    */

    [
      "last",
      "first",
      "classroom",
      "sex",
      "project1",
      "project2",
      "afl2",
      "afl3"
    ].forEach(field => {

      if (
        result[field] === "" ||
        result[field] == null
      ) {

        result[field] =
          incoming[field] ?? "";

      }

    });


    return result;
  }


  function mergeStudents(
    currentStudents = [],
    incomingStudents = []
  ) {

    const map =
      new Map();


    currentStudents.forEach(
      student => {

        map.set(
          studentKey(student),
          clone(student)
        );

      }
    );


    incomingStudents.forEach(
      student => {

        const key =
          studentKey(student);

        if (!map.has(key)) {

          map.set(
            key,
            clone(student)
          );

          return;
        }


        map.set(
          key,
          mergeStudent(
            map.get(key),
            student
          )
        );

      }
    );


    return Array.from(
      map.values()
    );
  }


  /* ========================================
     FUSION DES ÉVALUATIONS
  ======================================== */

  function mergeSessions(
    currentSessions = [],
    incomingSessions = []
  ) {

    const map =
      new Map();


    currentSessions.forEach(
      session => {

        map.set(
          String(session.id),
          clone(session)
        );

      }
    );


    incomingSessions.forEach(
      incoming => {

        const key =
          String(incoming.id);


        if (!map.has(key)) {

          map.set(
            key,
            clone(incoming)
          );

          return;
        }


        const current =
          map.get(key);


        map.set(
          key,
          {
            ...clone(incoming),
            ...clone(current),

            students:
              mergeStudents(
                current.students || [],
                incoming.students || []
              )
          }
        );

      }
    );


    return Array.from(
      map.values()
    );
  }


  /* ========================================
     FUSION DES ESPACES
  ======================================== */

  function mergeGroups(
    currentGroups = [],
    incomingGroups = []
  ) {

    const map =
      new Map();


    currentGroups.forEach(
      group => {

        map.set(
          String(group.id),
          clone(group)
        );

      }
    );


    incomingGroups.forEach(
      incoming => {

        const key =
          String(incoming.id);


        /*
          Espace absent :
          on récupère tout l’espace.
        */

        if (!map.has(key)) {

          map.set(
            key,
            clone(incoming)
          );

          return;
        }


        const current =
          map.get(key);


        map.set(
          key,
          {
            ...clone(incoming),
            ...clone(current),

            students:
              mergeStudents(
                current.students || [],
                incoming.students || []
              ),

            sessions:
              mergeSessions(
                current.sessions || [],
                incoming.sessions || []
              )
          }
        );

      }
    );


    return Array.from(
      map.values()
    );
  }


  /* ========================================
     FUSION HISTORIQUE
  ======================================== */

  function mergeHistory(
    current = [],
    incoming = []
  ) {

    const seen =
      new Set();

    const result =
      [];


    [
      ...current,
      ...incoming
    ].forEach(item => {

      const key =
        JSON.stringify(item);

      if (
        seen.has(key)
      ) {
        return;
      }

      seen.add(key);

      result.push(
        clone(item)
      );

    });


    return result;
  }


  /* ========================================
     FUSION COMPLÈTE
  ======================================== */

  function mergeDatabases(
    current,
    incoming
  ) {

    return normalizeDB({

      groups:
        mergeGroups(
          current.groups || [],
          incoming.groups || []
        ),

      activeGroupId:
        current.activeGroupId ||
        incoming.activeGroupId ||
        null,

      activeSessionId:
        current.activeSessionId ||
        incoming.activeSessionId ||
        null,

      history:
        mergeHistory(
          current.history || [],
          incoming.history || []
        )

    });
  }


  /* ========================================
     IMPORT SÉCURISÉ
  ======================================== */

  async function secureRestoreBackup(
    file
  ) {

    try {

      const content =
        await file.text();

      const parsed =
        JSON.parse(content);


      if (
        !validDatabase(parsed)
      ) {

        throw new Error(
          "Format invalide"
        );

      }


      const incoming =
        normalizeDB(parsed);


      /*
        On conserve toujours la base actuelle
        avant toute opération d’import.
      */

      const currentRaw =
        bkStore.getItem(KEY);

      if (currentRaw) {

        bkStore.setItem(
          BEFORE_IMPORT_KEY,
          currentRaw
        );

        bkStore.setItem(
          BEFORE_IMPORT_DATE_KEY,
          String(Date.now())
        );

      }


      const currentGroups =
        Array.isArray(db.groups)
          ? db.groups.length
          : 0;

      const importedGroups =
        Array.isArray(incoming.groups)
          ? incoming.groups.length
          : 0;


      const ok =
        confirm(
          "IMPORT SÉCURISÉ\n\n" +

          `Base actuelle : ${currentGroups} espace(s)\n` +
          `Sauvegarde importée : ${importedGroups} espace(s)\n\n` +

          "Les données importées vont être FUSIONNÉES avec les données actuelles.\n\n" +

          "Aucun espace actuellement enregistré ne sera supprimé.\n\n" +

          "Continuer ?"
        );


      if (!ok) {
        return;
      }


      db =
        mergeDatabases(
          db,
          incoming
        );


      secureSave();

      render();


      if (
        typeof toast ===
        "function"
      ) {

        toast(
          "Sauvegarde fusionnée"
        );

      }


    } catch (error) {

      console.error(
        error
      );

      alert(
        "Sauvegarde invalide ou impossible à importer."
      );

    }
  }


  /* ========================================
     RÉCUPÉRATION AUTOMATIQUE
  ======================================== */

  function availableBackups() {

    const list =
      [];


    for (
      let i = 1;
      i <= BACKUP_COUNT;
      i++
    ) {

      const raw =
        bkStore.getItem(
          BACKUP_PREFIX + i
        );

      if (!raw) {
        continue;
      }


      list.push({

        slot: i,

        raw,

        date:
          bkStore.getItem(
            BACKUP_DATE_PREFIX + i
          )

      });

    }


    const beforeImport =
      bkStore.getItem(
        BEFORE_IMPORT_KEY
      );


    if (beforeImport) {

      list.push({

        slot:
          "import",

        raw:
          beforeImport,

        date:
          bkStore.getItem(
            BEFORE_IMPORT_DATE_KEY
          ),

        beforeImport:
          true

      });

    }


    return list;
  }


  function recoverBackup() {

    const backups =
      availableBackups();


    if (!backups.length) {

      alert(
        "Aucune sauvegarde automatique disponible pour le moment."
      );

      return;
    }


    const text =
      backups
        .map(
          (backup, index) => {

            const label =
              backup.beforeImport
                ? "Avant le dernier import"
                : `Sauvegarde automatique ${backup.slot}`;

            return (
              `${index + 1}. ` +
              `${label}\n` +
              `${safeDate(backup.date)}`
            );

          }
        )
        .join(
          "\n\n"
        );


    const choice =
      prompt(
        "RÉCUPÉRATION\n\n" +
        text +
        "\n\n" +
        "Indique le numéro de la version à restaurer :",
        "1"
      );


    if (
      choice == null
    ) {
      return;
    }


    const selected =
      backups[
        Number(choice) - 1
      ];


    if (!selected) {

      alert(
        "Numéro de sauvegarde invalide."
      );

      return;
    }


    let recovered;

    try {

      recovered =
        normalizeDB(
          JSON.parse(
            selected.raw
          )
        );

    } catch {

      alert(
        "Cette sauvegarde est endommagée."
      );

      return;
    }


    const ok =
      confirm(
        "Restaurer cette version ?\n\n" +
        `${safeDate(selected.date)}\n\n` +
        "La base actuelle sera conservée comme sauvegarde de secours avant restauration."
      );


    if (!ok) {
      return;
    }


    /*
      On garde d’abord la situation actuelle.
    */

    const currentRaw =
      bkStore.getItem(KEY);

    if (currentRaw) {

      rotateBackups(
        currentRaw
      );

    }


    db =
      recovered;


    bkStore.setItem(
      KEY,
      JSON.stringify(db)
    );


    render();


    if (
      typeof toast ===
      "function"
    ) {

      toast(
        "Version restaurée"
      );

    }

  }


  /* ========================================
     BOUTON RÉCUPÉRATION
  ======================================== */

  function createRecoveryButton() {

    if (
      document.getElementById(
        "recoveryBackup"
      )
    ) {
      return;
    }


    const actions =
      document.querySelector(
        "header > div:last-child"
      );


    if (!actions) {
      return;
    }


    const button =
      document.createElement(
        "button"
      );


    button.id =
      "recoveryBackup";

    button.type =
      "button";

    button.textContent =
      "↶ Récupération";

    button.onclick =
      recoverBackup;


    actions.appendChild(
      button
    );
  }


  /* ========================================
     ACTIVATION
  ======================================== */

  /*
    On remplace uniquement les fonctions
    de stockage existantes.
    Le reste de app.js reste intact.
  */

  save =
    secureSave;

  restoreBackup =
    secureRestoreBackup;


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(
      "DOMContentLoaded",
      createRecoveryButton
    );

  } else {

    createRecoveryButton();

  }

})();
