## Regras de Build e Release

### Binarios permitidos na build (extraResources)
- `bin/auto-editor.exe`
- `bin/ffmpeg.exe`
- `bin/ffplay.exe`
- `bin/ffprobe.exe`
- `bin/whisper/ggml-tiny.bin` — UNICO modelo permitido no pacote

### Binarios PROIBIDOS na build
- `bin/whisper/whisper-cli.exe` — usuario baixa via CUDA download
- `bin/whisper/ggml-*.bin` (exceto tiny) — usuario baixa pelo menu
- `bin/whisper/*.dll` — CUDA DLLs baixadas pelo usuario
- `dist/win-unpacked/` — output do electron-builder, nao empacotar

### CUDA (GPU NVIDIA)
- NAO incluir na build do app
- Entrega via GitHub Releases: upload de `whisper-cuda.zip` (~422 MB)
- URL fixa: `https://github.com/LuizFelipeRDev/corgi-editor/releases/download/v1.0.0/whisper-cuda.zip`
- Usuario baixa pelo botao "BAIXAR GPU" nas Configuracoes > Geral
- Arquivos extraidos para `%APPDATA%/corgi-editor/bin/whisper/`

### Modelos de whisper
- Apenas `ggml-tiny.bin` vem embutido na build
- Demais modelos (base, small, medium, large-v3) sao baixados pelo usuario
- Downloads salvos em `%APPDATA%/corgi-editor/bin/whisper/`

### Estrutura de diretorios em producao
%APPDATA%/corgi-editor/
  config.ini
  bin/
    auto-editor.exe
    ffmpeg.exe
    ffplay.exe
    ffprobe.exe
    whisper/
      ggml-tiny.bin          (bundled)
      whisper-cli.exe        (downloaded via CUDA)
      ggml-cuda.dll          (downloaded via CUDA)
      cublas64_12.dll         (downloaded via CUDA)
      ...                    (outros modelos downloads)
  fonts/
    *.ttf
Acoes necessarias
1. Criar AGENTS.md na raiz do projeto com as regras acima
2. Criar GitHub Release v1.0.0 e fazer upload de whisper-cuda.zip
3. Atualizar URL em electron/main.cjs:678
4. Rebuild e testar


# Git — Commit, Tag e Release

Suba as alterações para o GitHub seguindo **rigorosamente** as convenções abaixo.

> **IMPORTANTE:** Não invente informações, versões, funcionalidades, correções ou arquivos.
> Use somente informações comprovadamente presentes nas alterações realizadas no projeto ou informadas pelo usuário.

---

## Commits

Faça o commit das alterações.

### Formato da mensagem

A mensagem deve ser **curta e objetiva**, seguindo:

`<tipo>: <versão> - descrição curta das alterações`

Exemplo:

`feat: v1.3.0 - playlist subfolder, show-filesize option, deploy docs`

### Tipos permitidos

Use somente um dos tipos abaixo:

- `feat` — nova funcionalidade
- `docs` — documentação
- `chore` — tarefas de manutenção
- `fix` — correção de problema
- `bugfix` — correção de bug
- `perf` — melhoria de desempenho
- `refactor` — refatoração sem alteração de comportamento
- `style` — alterações de estilo/formatação
- `test` — testes
- `revert` — reversão de alteração
- `ci` — integração/automação
- `build` — alterações relacionadas ao build

### Regras importantes

- **Todas as mensagens de commit, release e tag DEVEM ser escritas em INGLÊS.**
- Não invente o tipo do commit.
- Analise as alterações reais (`git diff`, `git status`) antes de definir o tipo.
- Não descreva funcionalidades que não estejam presentes nas alterações.
- Não inclua alterações não relacionadas ao objetivo do commit.
- Não faça `git add .` automaticamente se isso puder incluir arquivos não relacionados.
- Verifique quais arquivos serão incluídos antes do commit.
- Não altere arquivos apenas para justificar uma mensagem de commit.
- Se houver alterações não relacionadas, pergunte ao usuário se elas devem ser incluídas.
- A mensagem deve representar **somente o que realmente foi alterado**.

---

## Versões

A versão deve seguir:

- `v1.0.0` = primeira versão estável
- `v0.1.0` = implementação de módulo, funcionalidade relevante, refatoração ou alteração significativa
- `v0.0.1` = correções, bugfixes, pequenos ajustes etc.

### Regra obrigatória

**A versão NÃO deve ser inventada ou inferida automaticamente.**

- O usuário deve informar qual versão deseja utilizar.
- Se o usuário **não informar a versão**, PARE e pergunte qual versão deve ser utilizada.
- Não escolha `v0.0.1`, `v0.1.0` ou qualquer outra versão por conta própria.
- Não altere `package.json`, `package-lock.json`, `version`, manifestos ou outros arquivos de versão, a menos que o usuário tenha solicitado.
- Não crie uma nova versão baseado apenas na quantidade ou importância das alterações.

---

## Tags

Depois do commit, crie e suba a tag correspondente à versão informada pelo usuário.

### Formato da tag

A tag deve seguir:

`v1.3.0`

E a mensagem da tag deve seguir:

`Release v1.3.0`

### Regras obrigatórias

- O usuário deve informar a versão.
- Se a versão não tiver sido informada, **pergunte antes de continuar**.
- Não invente a versão.
- Não crie tags adicionais.
- Não altere ou sobrescreva uma tag existente sem autorização explícita do usuário.
- Antes de criar a tag, verifique se ela já existe.
- A tag deve apontar para o commit criado nesta operação.
- Depois de criar a tag, faça o push da tag para o GitHub.


---

## Release

Crie a Release correspondente à tag criada.

### Título

O título da Release deve ser:

`Release v1.3.0`

Substitua `v1.3.0` pela versão informada pelo usuário.

### Corpo da Release

O corpo deve conter:

1. A versão.
2. Um resumo das alterações realizadas.
3. As alterações organizadas de acordo com o `commit info`.
4. Somente informações comprovadas pelas alterações realizadas.

Exemplo:

```commit
## feat: v1.3.0 - playlist subfolder, show-filesize option, deploy docs

### Features

- **Rename**: YtCorgiDown → CorgiDown
- **Multiplatform**: Suporte a Facebook, Dailymotion, Bilibili e outros sites via yt-dlp
- **Crop thumbnail 1:1**: Capas de música cortadas em proporção quadrada (center crop)
- **Aviso de metadados**: Mensagem quando não consegue obter informações do link (5 segundos)

### Fix

- Mensagem "Salvo em:" agora mostra o caminho correto do arquivo
- Formato de vídeo com fallbacks para compatibilidade com mais sites
- Caminho do ffmpeg corrigido para crop de thumbnail
- Limpeza automática de arquivos `.jpg` residuais
- Erro detalhado com `stderr` do yt-dlp

### Stack

- Electron 44 + Vite 6 + React 19 + Tailwind CSS 4
- yt-dlp + ffmpeg + Deno

```

### Regras Obrigatorias do Release

- Se o usuario pedir pra anexar a build no release do programa, gere uma nova build e coloque ele em ZIP