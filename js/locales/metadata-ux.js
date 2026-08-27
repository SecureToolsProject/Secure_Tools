export const metadataUxLocales = {
  en: {
    image: {
      source: { selectedLabel: "Selected source image", meta: "{format} · {size}", remove: "Remove source image" },
      inspector: { decodedTitle: "Decoded metadata", summary: "{groups} decoded groups · {additional} additional structures", noDecoded: "No supported metadata values were decoded.", additional: "{count} additional metadata structure(s) were detected but not fully decoded.", additionalDecoded: "{count} additional decoded field(s) are available in details.", details: "View details", detailTitle: "All detected metadata", diagnosticsTitle: "Parser diagnostics" },
      clean: { policy: "Removes supported privacy metadata while preserving valid rendering orientation and ICC profiles.", customize: "Customize", customizeDescription: "Choose only metadata classes supported by the current format and verification layer.", customButton: "Clean with custom policy and save" },
      policy: { legend: "Custom cleaning policy", removeExif: "Remove privacy-related EXIF (keep valid orientation)", removeXmp: "Remove XMP", removeIptc: "Remove IPTC", removeComments: "Remove JPEG comments", removeTextMetadata: "Remove PNG text metadata", removeTimestamps: "Remove PNG timestamps", preserveIcc: "Preserve ICC color profile" },
    },
    pdf: {
      source: { selectedLabel: "Selected source PDF", meta: "PDF · {size}", remove: "Remove source PDF" },
      inspector: { decodedTitle: "Decoded document metadata", summary: "{count} supported decoded field(s)", noDecoded: "No supported document-info values were found.", additionalDecoded: "{count} additional decoded field(s) are available in details.", details: "View details", detailsHelp: "The detailed view includes every supported document-info field. It does not inspect XMP or hidden PDF structures." },
      actions: { privacyClean: "Privacy Clean and save PDF", customize: "Customize", customClean: "Clean selected fields and save" },
      custom: { description: "Select standard document-info fields to remove. This does not edit values or expand the supported PDF scope.", legend: "Fields to remove" },
      errors: { verification: "The requested metadata fields remained after verification, so no file was saved." },
    },
  },
  ko: {
    image: {
      source: { selectedLabel: "선택한 원본 이미지", meta: "{format} · {size}", remove: "원본 이미지 제거" },
      inspector: { decodedTitle: "해석된 메타데이터", summary: "해석된 그룹 {groups}개 · 추가 구조 {additional}개", noDecoded: "지원되는 메타데이터 값을 해석하지 못했습니다.", additional: "추가 메타데이터 구조 {count}개를 감지했지만 완전히 해석하지는 못했습니다.", additionalDecoded: "추가로 해석된 필드 {count}개는 세부 정보에서 확인할 수 있습니다.", details: "세부 정보 보기", detailTitle: "감지된 모든 메타데이터", diagnosticsTitle: "파서 진단" },
      clean: { policy: "지원되는 개인정보 메타데이터를 제거하고 유효한 표시 방향과 ICC 프로필은 유지합니다.", customize: "사용자 지정", customizeDescription: "현재 형식과 검증 계층이 지원하는 메타데이터 종류만 선택합니다.", customButton: "사용자 지정 정책으로 정리하고 저장" },
      policy: { legend: "사용자 지정 정리 정책", removeExif: "개인정보 관련 EXIF 제거(유효한 방향 유지)", removeXmp: "XMP 제거", removeIptc: "IPTC 제거", removeComments: "JPEG 주석 제거", removeTextMetadata: "PNG 텍스트 메타데이터 제거", removeTimestamps: "PNG 타임스탬프 제거", preserveIcc: "ICC 색상 프로필 유지" },
    },
    pdf: {
      source: { selectedLabel: "선택한 원본 PDF", meta: "PDF · {size}", remove: "원본 PDF 제거" },
      inspector: { decodedTitle: "해석된 문서 메타데이터", summary: "지원되는 해석 필드 {count}개", noDecoded: "지원되는 문서 정보 값을 찾지 못했습니다.", additionalDecoded: "추가로 해석된 필드 {count}개는 세부 정보에서 확인할 수 있습니다.", details: "세부 정보 보기", detailsHelp: "세부 보기에는 지원되는 모든 문서 정보 필드가 표시됩니다. XMP나 숨겨진 PDF 구조는 검사하지 않습니다." },
      actions: { privacyClean: "개인정보 정리 후 PDF 저장", customize: "사용자 지정", customClean: "선택한 필드 정리 후 저장" },
      custom: { description: "제거할 표준 문서 정보 필드를 선택합니다. 값을 편집하거나 지원 PDF 범위를 넓히지 않습니다.", legend: "제거할 필드" },
      errors: { verification: "검증 후에도 요청한 메타데이터 필드가 남아 있어 파일을 저장하지 않았습니다." },
    },
  },
  ja: {
    image: {
      source: { selectedLabel: "選択した元画像", meta: "{format} · {size}", remove: "元画像を削除" },
      inspector: { decodedTitle: "デコード済みメタデータ", summary: "デコード済みグループ {groups} 件 · 追加構造 {additional} 件", noDecoded: "対応するメタデータ値はデコードされませんでした。", additional: "追加のメタデータ構造を {count} 件検出しましたが、完全にはデコードされていません。", additionalDecoded: "追加のデコード済みフィールド {count} 件は詳細で確認できます。", details: "詳細を表示", detailTitle: "検出されたすべてのメタデータ", diagnosticsTitle: "パーサー診断" },
      clean: { policy: "対応するプライバシーメタデータを削除し、有効な表示方向と ICC プロファイルを保持します。", customize: "カスタマイズ", customizeDescription: "現在の形式と検証レイヤーが対応するメタデータ分類だけを選択します。", customButton: "カスタムポリシーで消去して保存" },
      policy: { legend: "カスタム消去ポリシー", removeExif: "プライバシー関連 EXIF を削除（有効な方向は保持）", removeXmp: "XMP を削除", removeIptc: "IPTC を削除", removeComments: "JPEG コメントを削除", removeTextMetadata: "PNG テキストメタデータを削除", removeTimestamps: "PNG タイムスタンプを削除", preserveIcc: "ICC カラープロファイルを保持" },
    },
    pdf: {
      source: { selectedLabel: "選択した元PDF", meta: "PDF · {size}", remove: "元PDFを削除" },
      inspector: { decodedTitle: "デコード済み文書メタデータ", summary: "対応するデコード済みフィールド {count} 件", noDecoded: "対応する文書情報の値は見つかりませんでした。", additionalDecoded: "追加のデコード済みフィールド {count} 件は詳細で確認できます。", details: "詳細を表示", detailsHelp: "詳細表示には対応するすべての文書情報フィールドが含まれます。XMP や隠し PDF 構造は検査しません。" },
      actions: { privacyClean: "プライバシー消去して PDF を保存", customize: "カスタマイズ", customClean: "選択したフィールドを消去して保存" },
      custom: { description: "削除する標準文書情報フィールドを選択します。値の編集や PDF 対応範囲の拡張は行いません。", legend: "削除するフィールド" },
      errors: { verification: "検証後も指定したメタデータ項目が残っていたため、ファイルは保存されませんでした。" },
    },
  },
  es: {
    image: {
      source: { selectedLabel: "Imagen de origen seleccionada", meta: "{format} · {size}", remove: "Quitar imagen de origen" },
      inspector: { decodedTitle: "Metadatos decodificados", summary: "{groups} grupos decodificados · {additional} estructuras adicionales", noDecoded: "No se decodificaron valores de metadatos compatibles.", additional: "Se detectaron {count} estructuras de metadatos adicionales, pero no se decodificaron por completo.", additionalDecoded: "Hay {count} campos decodificados adicionales disponibles en los detalles.", details: "Ver detalles", detailTitle: "Todos los metadatos detectados", diagnosticsTitle: "Diagnósticos del analizador" },
      clean: { policy: "Elimina metadatos de privacidad compatibles y conserva la orientación de visualización válida y los perfiles ICC.", customize: "Personalizar", customizeDescription: "Elige solo clases de metadatos compatibles con el formato actual y la verificación.", customButton: "Limpiar con política personalizada y guardar" },
      policy: { legend: "Política de limpieza personalizada", removeExif: "Eliminar EXIF privado (conservar orientación válida)", removeXmp: "Eliminar XMP", removeIptc: "Eliminar IPTC", removeComments: "Eliminar comentarios JPEG", removeTextMetadata: "Eliminar metadatos de texto PNG", removeTimestamps: "Eliminar marcas de tiempo PNG", preserveIcc: "Conservar el perfil de color ICC" },
    },
    pdf: {
      source: { selectedLabel: "PDF de origen seleccionado", meta: "PDF · {size}", remove: "Quitar PDF de origen" },
      inspector: { decodedTitle: "Metadatos del documento decodificados", summary: "{count} campos compatibles decodificados", noDecoded: "No se encontraron valores de información de documento compatibles.", additionalDecoded: "Hay {count} campos decodificados adicionales disponibles en los detalles.", details: "Ver detalles", detailsHelp: "La vista detallada incluye todos los campos de información de documento compatibles. No inspecciona XMP ni estructuras PDF ocultas." },
      actions: { privacyClean: "Limpieza de privacidad y guardar PDF", customize: "Personalizar", customClean: "Limpiar campos seleccionados y guardar" },
      custom: { description: "Selecciona campos estándar de información de documento para eliminarlos. No edita valores ni amplía el alcance PDF compatible.", legend: "Campos que se eliminarán" },
      errors: { verification: "Los campos de metadatos solicitados permanecieron tras la verificación, por lo que no se guardó ningún archivo." },
    },
  },
  de: {
    image: {
      source: { selectedLabel: "Ausgewähltes Quellbild", meta: "{format} · {size}", remove: "Quellbild entfernen" },
      inspector: { decodedTitle: "Dekodierte Metadaten", summary: "{groups} dekodierte Gruppen · {additional} zusätzliche Strukturen", noDecoded: "Keine unterstützten Metadatenwerte wurden dekodiert.", additional: "{count} zusätzliche Metadatenstrukturen wurden erkannt, aber nicht vollständig dekodiert.", additionalDecoded: "{count} weitere dekodierte Felder sind in den Details verfügbar.", details: "Details anzeigen", detailTitle: "Alle erkannten Metadaten", diagnosticsTitle: "Parserdiagnose" },
      clean: { policy: "Entfernt unterstützte Datenschutzmetadaten und erhält gültige Anzeigeausrichtung und ICC-Profile.", customize: "Anpassen", customizeDescription: "Wählen Sie nur Metadatenklassen, die das aktuelle Format und die Verifikation unterstützen.", customButton: "Mit eigener Richtlinie bereinigen und speichern" },
      policy: { legend: "Eigene Bereinigungsrichtlinie", removeExif: "Datenschutzrelevante EXIF entfernen (Ausrichtung erhalten)", removeXmp: "XMP entfernen", removeIptc: "IPTC entfernen", removeComments: "JPEG-Kommentare entfernen", removeTextMetadata: "PNG-Textmetadaten entfernen", removeTimestamps: "PNG-Zeitstempel entfernen", preserveIcc: "ICC-Farbprofil beibehalten" },
    },
    pdf: {
      source: { selectedLabel: "Ausgewählte Quell-PDF", meta: "PDF · {size}", remove: "Quell-PDF entfernen" },
      inspector: { decodedTitle: "Dekodierte Dokumentmetadaten", summary: "{count} unterstützte dekodierte Felder", noDecoded: "Keine unterstützten Dokumentinfo-Werte gefunden.", additionalDecoded: "{count} weitere dekodierte Felder sind in den Details verfügbar.", details: "Details anzeigen", detailsHelp: "Die Detailansicht enthält alle unterstützten Dokumentinfo-Felder. XMP und verborgene PDF-Strukturen werden nicht untersucht." },
      actions: { privacyClean: "Datenschutzbereinigung und PDF speichern", customize: "Anpassen", customClean: "Ausgewählte Felder bereinigen und speichern" },
      custom: { description: "Wählen Sie zu entfernende Standard-Dokumentinfo-Felder. Werte werden nicht bearbeitet und der PDF-Prüfumfang wird nicht erweitert.", legend: "Zu entfernende Felder" },
      errors: { verification: "Die angeforderten Metadatenfelder waren nach der Prüfung noch vorhanden; daher wurde keine Datei gespeichert." },
    },
  },
  fr: {
    image: {
      source: { selectedLabel: "Image source sélectionnée", meta: "{format} · {size}", remove: "Retirer l’image source" },
      inspector: { decodedTitle: "Métadonnées décodées", summary: "{groups} groupes décodés · {additional} structures supplémentaires", noDecoded: "Aucune valeur de métadonnée prise en charge n’a été décodée.", additional: "{count} structures de métadonnées supplémentaires ont été détectées sans être entièrement décodées.", additionalDecoded: "{count} champs décodés supplémentaires sont disponibles dans les détails.", details: "Afficher les détails", detailTitle: "Toutes les métadonnées détectées", diagnosticsTitle: "Diagnostics de l’analyseur" },
      clean: { policy: "Supprime les métadonnées de confidentialité prises en charge tout en conservant une orientation d’affichage valide et les profils ICC.", customize: "Personnaliser", customizeDescription: "Choisissez uniquement les classes prises en charge par le format actuel et la vérification.", customButton: "Nettoyer avec la règle personnalisée et enregistrer" },
      policy: { legend: "Règle de nettoyage personnalisée", removeExif: "Supprimer les EXIF privés (garder l’orientation valide)", removeXmp: "Supprimer XMP", removeIptc: "Supprimer IPTC", removeComments: "Supprimer les commentaires JPEG", removeTextMetadata: "Supprimer les métadonnées texte PNG", removeTimestamps: "Supprimer les horodatages PNG", preserveIcc: "Conserver le profil colorimétrique ICC" },
    },
    pdf: {
      source: { selectedLabel: "PDF source sélectionné", meta: "PDF · {size}", remove: "Retirer le PDF source" },
      inspector: { decodedTitle: "Métadonnées du document décodées", summary: "{count} champs pris en charge décodés", noDecoded: "Aucune valeur d’information de document prise en charge n’a été trouvée.", additionalDecoded: "{count} champs décodés supplémentaires sont disponibles dans les détails.", details: "Afficher les détails", detailsHelp: "La vue détaillée contient tous les champs d’information de document pris en charge. Elle n’inspecte pas XMP ni les structures PDF masquées." },
      actions: { privacyClean: "Nettoyage de confidentialité et enregistrer le PDF", customize: "Personnaliser", customClean: "Nettoyer les champs sélectionnés et enregistrer" },
      custom: { description: "Sélectionnez les champs d’information de document standard à supprimer. Les valeurs ne sont pas modifiées et la portée PDF n’est pas élargie.", legend: "Champs à supprimer" },
      errors: { verification: "Les champs de métadonnées demandés subsistaient après vérification ; aucun fichier n’a donc été enregistré." },
    },
  },
};
