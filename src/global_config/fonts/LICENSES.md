# Licenças das fontes embutidas

Os arquivos `.ttf` desta pasta são redistribuídos junto com o aplicativo (no build:
`extraResources` → `resources/fonts/`, e na primeira execução são espelhados para
`%APPDATA%/corgi-editor/fonts/`). Como a redistribuição de software de fonte exige que a
licença acompanhe os arquivos, ela está incluída aqui:

- `LICENSE-OFL-1.1.txt` — SIL Open Font License 1.1 (usada por 14 das 16 famílias)
- `LICENSE-APACHE-2.0.txt` — Apache License 2.0 (Luckiest Guy)
- `LICENSE-APOSTROPHIC-FREEWARE.txt` — freeware da Apostrophic Laboratories (Komika Axis)

As três permitem **uso comercial** (vídeos monetizados, trabalhos para clientes, anúncios),
embutição em vídeo e redistribuição — desde que a licença acompanhe a distribuição e a
fonte não seja vendida isoladamente. A da Apostrophic (Komika Axis) exige ainda: não
produzir material racista, criminal e/ou ilegal; não modificar a fonte para
reembalagem/re-release sem autorização; e a fonte jamais pode ser vendida ou comprada.

## Manifesto

| Arquivo | Família | Licença | Copyright |
|---|---|---|---|
| `Anton-Regular.ttf` | Anton | OFL 1.1 | Copyright 2020 The Anton Project Authors (https://github.com/googlefonts/AntonFont.git) |
| `ArchivoBlack-Regular.ttf` | Archivo Black | OFL 1.1 | Copyright 2017 The Archivo Black Project Authors (https://github.com/Omnibus-Type/ArchivoBlack) |
| `Bangers-Regular.ttf` | Bangers | OFL 1.1 | Copyright 2010 The Bangers Project Authors (https://github.com/googlefonts/bangers) |
| `BebasNeue-Regular.ttf` | Bebas Neue | OFL 1.1 | Copyright 2019 The Bebas Neue Project Authors (https://github.com/dharmatype/Bebas-Neue) |
| `FiraSansCondensed-Bold.ttf` | Fira Sans Condensed | OFL 1.1 | Digitized data copyright 2012-2016, The Mozilla Foundation and Telefonica S.A. |
| `IBMPlexSans-Bold.ttf` | IBM Plex Sans | OFL 1.1 | Copyright 2019 IBM Corp. All rights reserved. |
| `IBMPlexSans-Regular.ttf` | IBM Plex Sans | OFL 1.1 | Copyright 2019 IBM Corp. All rights reserved. |
| `Inter-Bold.ttf` | Inter | OFL 1.1 | Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter) |
| `LuckiestGuy-Regular.ttf` | Luckiest Guy | **Apache 2.0** | Copyright (c) 2010 by Brian J. Bonislawsky DBA Astigmatic (AOETI) |
| `Montserrat-BoldItalic.ttf` | Montserrat | OFL 1.1 | Copyright 2011 The Montserrat Project Authors (https://github.com/JulietaUla/Montserrat) |
| `Montserrat-ExtraBold.ttf` | Montserrat | OFL 1.1 | Copyright 2011 The Montserrat Project Authors (https://github.com/JulietaUla/Montserrat) |
| `Oswald-Bold.ttf` | Oswald | OFL 1.1 | Copyright 2016 The Oswald Project Authors (https://github.com/googlefonts/OswaldFont) |
| `Poppins-ExtraBold.ttf` | Poppins | OFL 1.1 | Copyright 2020 The Poppins Project Authors (https://github.com/itfoundry/Poppins) |
| `Roboto-Black.ttf` | Roboto | OFL 1.1 | Copyright 2011 The Roboto Project Authors (https://github.com/googlefonts/roboto-classic) |
| `Rubik-ExtraBold.ttf` | Rubik | OFL 1.1 | Copyright 2015 The Rubik Project Authors (https://github.com/googlefonts/rubik) |
| `TitanOne-Regular.ttf` | Titan One | OFL 1.1 | Copyright (c) 2011 Rodrigo Fuenzalida, with Reserved Font Name "Titan One" |
| `lilita-one.regular.ttf` | Lilita One | OFL 1.1 | Copyright (c) 2011 Juan Montoreano, with Reserved Font Names "Lilita One" |
| `komika-axis.regular.ttf` | Komika Axis | **Apostrophic freeware** (ver nota) | © 1999-2001, WolfBainX & Apostrophic Labs |

## Notas

- **`Rubik-ExtraBold.ttf`** é uma instância estática (`wght=800`) gerada a partir do
  `Rubik[wght].ttf` (fonte variável) do repositório `google/fonts`, já que a instância que a
  API do Google Fonts servia vinha com nome de família incorreto (`Rubik Light ExtraBold`).
  A OFL permite modificar a fonte; o nome original foi mantido (Rubik não declara Reserved
  Font Name).
- **`komika-axis.regular.ttf`** não traz campo de licença no arquivo — apenas o copyright
  acima. A licença oficial da Apostrophic Laboratories (texto completo em
  `LICENSE-APOSTROPHIC-FREEWARE.txt`) confirma que é **freeware, de uso livre inclusive
  comercial**, com as condições: (1) não produzir material racista, criminal e/ou ilegal;
  (2) não modificar a fonte para reembalagem/re-release sem autorização expressa dos
  designers; (3) a fonte/design não pode ser vendido nem comprado sob nenhuma circunstância.
  Redistribuir o `.ttf` junto com o app (extraResources) é permitido desde que o texto da
  licença acompanhe os arquivos.
- **Impact / Arial Black** (fontes comuns em legendas) **não** são usadas: são proprietárias
  (Monotype) e não podem ser redistribuídas.
