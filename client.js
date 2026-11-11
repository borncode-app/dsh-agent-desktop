window.__ModuleLoader__.load({
  id: '@local/dsh-agent-desktop',
  factory: (require) => {
    const React = require('react')

    /** Dictionary namespace owned by this plugin. */
    const NS = 'settings.agent-desktop'
    /** Must match the Host row's `endpoint`. */
    const ENDPOINT = '/plugins/agent-desktop'

    /** English copy. */
    const en = {
      'nav': 'Agent desktop',
      'title': 'Agent desktop',
      'intro': 'Lets the agent see and operate this computer through the native agent-desktop CLI. The binary installs itself, checks GitHub for a newer release every time the Harness starts, and answers through first-class tools.',
      'installed': 'Installed version',
      'latest': 'Latest release',
      'path': 'Install path',
      'permissions': 'Permissions',
      'stateRoot': 'State root',
      'surfaces': 'Surfaces',
      'lastCheck': 'Last check',
      'platform': 'Platform',
      'release': 'Release page',
      'tools': 'Tools the model calls',
      'toolsHint': 'The model calls these directly; it never has to run a shell command.',
      'autoUpdate': 'Update on every launch',
      'autoUpdateHint': 'Check GitHub for a newer agent-desktop release every time the Harness starts, and install it when one appears.',
      'update': 'Update now',
      'check': 'Check for updates',
      'health': 'Run a health check',
      'guide': 'Read the guide',
      'busy': 'Working…',
      'ready': 'Ready',
      'checking': 'Checking for a newer release…',
      'downloading': 'Downloading the release…',
      'error': 'Not ready',
      'never': 'Never',
      'none': 'None',
      'unknown': 'Unknown',
      'upToDate': 'The installed release is the newest one.',
      'updateReady': 'A newer release is available.',
      'updated': 'The newer release is installed.',
      'healthOk': 'The binary answered.',
      'healthFailed': 'The binary did not answer.',
      'guideTitle': 'The guide of the installed version',
      'loading': 'Loading…',
      'unavailable': 'The agent-desktop service is not available.',
      'failed': 'The action failed.',
      'section': 'Agent desktop',
    }

    /** Thai copy. */
    const th = {
      'nav': 'เดสก์ท็อปสำหรับเอเจนต์',
      'title': 'เดสก์ท็อปสำหรับเอเจนต์',
      'intro': 'ให้เอเจนต์มองเห็นและควบคุมเครื่องนี้ผ่าน agent-desktop ซึ่งเป็นไบนารีเนทีฟ ตัวไบนารีติดตั้งตัวเอง ตรวจ GitHub หาเวอร์ชันใหม่ทุกครั้งที่เปิดแอป และตอบผ่านเครื่องมือที่เรียกใช้ได้โดยตรง',
      'installed': 'เวอร์ชันที่ติดตั้ง',
      'latest': 'รุ่นล่าสุด',
      'path': 'ตำแหน่งติดตั้ง',
      'permissions': 'สิทธิ์',
      'stateRoot': 'ตำแหน่งเก็บสถานะ',
      'surfaces': 'พื้นที่ที่อ่านได้',
      'lastCheck': 'ตรวจล่าสุด',
      'platform': 'แพลตฟอร์ม',
      'release': 'หน้าเวอร์ชัน',
      'tools': 'เครื่องมือที่โมเดลเรียกใช้',
      'toolsHint': 'โมเดลเรียกเครื่องมือเหล่านี้โดยตรง ไม่ต้องรันคำสั่งในเทอร์มินัล',
      'autoUpdate': 'อัปเดตทุกครั้งที่เปิดแอป',
      'autoUpdateHint': 'ตรวจ GitHub หา agent-desktop รุ่นใหม่ทุกครั้งที่เปิด Harness และติดตั้งให้อัตโนมัติเมื่อมี',
      'update': 'อัปเดตตอนนี้',
      'check': 'ตรวจหาเวอร์ชันใหม่',
      'health': 'ทดสอบการทำงาน',
      'guide': 'อ่านคู่มือ',
      'busy': 'กำลังทำงาน…',
      'ready': 'พร้อมใช้งาน',
      'checking': 'กำลังตรวจหาเวอร์ชันใหม่…',
      'downloading': 'กำลังดาวน์โหลดรุ่นใหม่…',
      'error': 'ยังไม่พร้อมใช้งาน',
      'never': 'ไม่เคย',
      'none': 'ไม่มี',
      'unknown': 'ไม่ทราบ',
      'upToDate': 'เวอร์ชันที่ติดตั้งเป็นรุ่นล่าสุดแล้ว',
      'updateReady': 'มีเวอร์ชันใหม่พร้อมใช้งาน',
      'updated': 'ติดตั้งเวอร์ชันใหม่เรียบร้อยแล้ว',
      'healthOk': 'ไบนารีตอบกลับสำเร็จ',
      'healthFailed': 'ไบนารีไม่ตอบกลับ',
      'guideTitle': 'คู่มือของเวอร์ชันที่ติดตั้ง',
      'loading': 'กำลังโหลด…',
      'unavailable': 'ไม่พบบริการ agent-desktop',
      'failed': 'ดำเนินการไม่สำเร็จ',
      'section': 'เดสก์ท็อปสำหรับเอเจนต์',
    }

    /** Simplified Chinese copy. */
    const zh = {
      'nav': '智能体桌面',
      'title': '智能体桌面',
      'intro': '让智能体通过原生 agent-desktop CLI 观察并操作这台电脑。该二进制文件会自行安装，每次启动 Harness 时都会检查 GitHub 上的新版本，并通过原生工具返回结果。',
      'installed': '已安装版本',
      'latest': '最新版本',
      'path': '安装路径',
      'permissions': '权限',
      'stateRoot': '状态目录',
      'surfaces': '可读取的界面',
      'lastCheck': '上次检查',
      'platform': '平台',
      'release': '版本页面',
      'tools': '模型调用的工具',
      'toolsHint': '模型直接调用这些工具，无需运行终端命令。',
      'autoUpdate': '每次启动时更新',
      'autoUpdateHint': '每次启动 Harness 时检查 GitHub 上的新 agent-desktop 版本，并在有新版本时自动安装。',
      'update': '立即更新',
      'check': '检查更新',
      'health': '运行健康检查',
      'guide': '阅读指南',
      'busy': '处理中…',
      'ready': '就绪',
      'checking': '正在检查新版本…',
      'downloading': '正在下载版本…',
      'error': '尚未就绪',
      'never': '从未',
      'none': '无',
      'unknown': '未知',
      'upToDate': '已安装的版本就是最新版本。',
      'updateReady': '有新版本可用。',
      'updated': '新版本已安装。',
      'healthOk': '二进制文件正常响应。',
      'healthFailed': '二进制文件没有响应。',
      'guideTitle': '已安装版本的指南',
      'loading': '加载中…',
      'unavailable': 'agent-desktop 服务不可用。',
      'failed': '操作失败。',
      'section': '智能体桌面',
    }

    /** The row's own styles; the class names are unique to this plugin. */
    const css = [
      '.dshad_section{display:flex;flex-direction:column;gap:16px;max-width:760px}',
      '.dshad_title{font-size:14px;line-height:20px;color:var(--dsw-alias-label-primary);margin:0}',
      '.dshad_description{margin:4px 0 0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dshad_badge{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;height:24px;padding:0 10px;border-radius:var(--dsw-radius-md);font-size:12px;line-height:18px;background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-secondary)}',
      '.dshad_badgeOk{color:var(--dsw-alias-state-success-primary)}',
      '.dshad_badgeBusy{color:var(--dsw-alias-label-primary)}',
      '.dshad_badgeError{color:var(--dsw-alias-state-error-primary)}',
      '.dshad_rows{display:flex;flex-direction:column;gap:1px;background:var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);overflow:hidden}',
      '.dshad_row{display:flex;align-items:baseline;gap:16px;padding:10px 12px;background:var(--dsw-alias-bg-module-platform)}',
      '.dshad_rowLabel{flex:0 0 190px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dshad_rowValue{flex:1 1 auto;min-width:0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary);overflow-wrap:anywhere}',
      '.dshad_rowValueMono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:12px}',
      '.dshad_actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}',
      '.dshad_button{height:32px;padding:0 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;line-height:20px;cursor:pointer}',
      '@media (hover:hover){.dshad_button:hover{background:var(--dsw-alias-interactive-bg-hover)}}',
      '.dshad_button:disabled{opacity:.5;cursor:default}',
      '.dshad_buttonPrimary{background:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-on-primary);border-color:transparent}',
      '.dshad_status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dshad_statusError{color:var(--dsw-alias-state-error-primary)}',
      '.dshad_statusOk{color:var(--dsw-alias-state-success-primary)}',
      '.dshad_separator{height:.5px;border:none;margin:0;background:var(--dsw-alias-border-l2)}',
      '.dshad_switchRow{display:flex;align-items:flex-start;gap:12px}',
      '.dshad_switch{position:relative;flex:0 0 auto;width:36px;height:20px;margin-top:2px;padding:0;border:none;border-radius:999px;background:var(--dsw-alias-border-l2);cursor:pointer}',
      '.dshad_switch[aria-checked="true"]{background:var(--dsw-alias-brand-primary)}',
      '.dshad_switch:disabled{opacity:.5;cursor:default}',
      '.dshad_switchKnob{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:var(--dsw-alias-bg-module-platform);transition:transform .12s ease-out}',
      '.dshad_switch[aria-checked="true"] .dshad_switchKnob{transform:translateX(16px)}',
      '.dshad_label{font-size:13px;line-height:20px;color:var(--dsw-alias-label-primary)}',
      '.dshad_hint{margin-top:2px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dshad_tools{display:flex;flex-wrap:wrap;gap:6px}',
      '.dshad_tool{padding:2px 8px;border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:18px;color:var(--dsw-alias-label-secondary)}',
      '.dshad_pre{max-height:320px;overflow:auto;margin:0;padding:12px;border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-module-platform);border:1px solid var(--dsw-alias-border-l2);font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:11px;line-height:17px;white-space:pre-wrap;overflow-wrap:anywhere;color:var(--dsw-alias-label-primary)}',
      '.dshad_link{color:var(--dsw-alias-brand-primary);font-size:12px;line-height:18px}',
    ].join('')

    /**
     * The plugin's own reader of its dictionaries.
     *
     * The locale service is bound when the page mounts; before that the raw key
     * is the honest answer.
     *
     * @param {string} key - the dictionary key.
     * @returns {string} the translated text.
     */
    let translate = (key) => key

    /**
     * The navigation icon of the settings section.
     *
     * @param {object} props - the row's own props.
     * @returns {object} the icon element.
     */
    function SectionIcon(props) {
      const size = typeof props?.size === 'number' ? props.size : 16
      const active = props?.active === true
      return React.createElement(
        'svg',
        {
          width: size,
          height: size,
          viewBox: '0 0 16 16',
          fill: 'none',
          'aria-hidden': 'true',
          style: { display: 'block', flex: '0 0 auto' },
        },
        React.createElement('rect', {
          x: 1.25,
          y: 2.25,
          width: 13.5,
          height: 9.5,
          rx: 1.75,
          stroke: 'currentColor',
          strokeWidth: 1.3,
          opacity: active ? 1 : 0.75,
        }),
        React.createElement('path', {
          d: 'M5.5 13.75h5',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          opacity: active ? 1 : 0.75,
        }),
        React.createElement('path', {
          d: 'M4.4 6.1 3.1 8.6a0.6 0.6 0 0 0 .9.75l.95-1.35.75 1.05',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          opacity: active ? 1 : 0.75,
        }),
      )
    }

    /**
     * The Agent desktop settings section.
     *
     * @returns {object} the section element.
     */
    function AgentDesktopSection(props) {
      const t = (key) => (typeof props?.t === 'function' ? props.t(key) : translate(key))
      const [report, setReport] = React.useState(null)
      const [error, setError] = React.useState(null)
      const [busy, setBusy] = React.useState(false)
      const [status, setStatus] = React.useState('')
      const [statusKind, setStatusKind] = React.useState('idle')
      const [health, setHealth] = React.useState(null)
      const [guide, setGuide] = React.useState('')

      /**
       * Read the plugin's own state from the Host.
       *
       * @returns {Promise<object | null>} the report, or null when it failed.
       */
      const load = React.useCallback(async () => {
        try {
          const response = await fetch(ENDPOINT, { headers: { accept: 'application/json' } })
          if (!response.ok) throw new Error(`status ${response.status}`)
          const body = await response.json()
          setReport(body)
          setError(null)
          return body
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
          return null
        }
      }, [])

      React.useEffect(() => {
        void load()
      }, [load])

      /**
       * Send one action to the Host and adopt its answer.
       *
       * @param {object} body - the action to send.
       * @returns {Promise<object | null>} the answer, or null when it failed.
       */
      const send = async (body) => {
        const response = await fetch(ENDPOINT, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify(body),
        })
        const answer = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(answer?.error ?? `status ${response.status}`)
        setReport(answer)
        return answer
      }

      /**
       * Run one action with the busy state around it.
       *
       * @param {object} body - the action to send.
       * @returns {Promise<void>} once the action settled.
       */
      const act = async (body) => {
        if (busy) return
        setBusy(true)
        try {
          await send(body)
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure))
          setStatusKind('error')
        } finally {
          setBusy(false)
        }
      }

      const phase = String(report?.phase ?? 'idle')
      const busyPhase = phase === 'checking' || phase === 'downloading'
      let badge
      let badgeClass = 'dshad_badge'
      if (report === null) {
        badge = t('loading')
      } else if (phase === 'error') {
        badge = t('error')
        badgeClass = 'dshad_badge dshad_badgeError'
      } else if (busyPhase) {
        badge = phase === 'checking' ? t('checking') : t('downloading')
        badgeClass = 'dshad_badge dshad_badgeBusy'
      } else {
        badge = t('ready')
        badgeClass = 'dshad_badge dshad_badgeOk'
      }

      const permissions = report?.permissions
      const permissionText = permissions && typeof permissions === 'object'
        ? Object.entries(permissions).map(([key, value]) => `${key}: ${value?.state ?? 'unknown'}`).join(', ')
        : t('unknown')
      const surfaces = Array.isArray(report?.supportedSurfaces) && report.supportedSurfaces.length > 0
        ? report.supportedSurfaces.join(', ')
        : t('none')
      const tools = Array.isArray(report?.tools) ? report.tools : []

      return React.createElement(
        'section',
        { className: 'dshad_section' },
        React.createElement('style', null, css),
        React.createElement(
          'div',
          null,
          React.createElement('h2', { className: 'dshad_title' }, t('title')),
          React.createElement('p', { className: 'dshad_description' }, t('intro')),
        ),
        React.createElement('span', { className: badgeClass, role: 'status' }, badge),
        error ? React.createElement('p', { className: 'dshad_status dshad_statusError', role: 'alert' }, `${t('failed')} ${error}`) : null,
        report?.lastError ? React.createElement('p', { className: 'dshad_status' }, report.lastError) : null,
        React.createElement(
          'div',
          { className: 'dshad_rows' },
          React.createElement(
            'div',
            { className: 'dshad_row' },
            React.createElement('div', { className: 'dshad_rowLabel' }, t('installed')),
            React.createElement('div', { className: 'dshad_rowValue' }, report?.installedVersion ?? t('unknown')),
          ),
          React.createElement(
            'div',
            { className: 'dshad_row' },
            React.createElement('div', { className: 'dshad_rowLabel' }, t('latest')),
            React.createElement('div', { className: 'dshad_rowValue' }, report?.latestVersion ?? t('unknown')),
          ),
          React.createElement(
            'div',
            { className: 'dshad_row' },
            React.createElement('div', { className: 'dshad_rowLabel' }, t('platform')),
            React.createElement('div', { className: 'dshad_rowValue' }, report?.platform ?? t('unknown')),
          ),
          React.createElement(
            'div',
            { className: 'dshad_row' },
            React.createElement('div', { className: 'dshad_rowLabel' }, t('permissions')),
            React.createElement('div', { className: 'dshad_rowValue' }, permissionText),
          ),
          React.createElement(
            'div',
            { className: 'dshad_row' },
            React.createElement('div', { className: 'dshad_rowLabel' }, t('surfaces')),
            React.createElement('div', { className: 'dshad_rowValue' }, surfaces),
          ),
          React.createElement(
            'div',
            { className: 'dshad_row' },
            React.createElement('div', { className: 'dshad_rowLabel' }, t('path')),
            React.createElement('div', { className: 'dshad_rowValue dshad_rowValueMono' }, report?.installPath ?? t('unknown')),
          ),
          React.createElement(
            'div',
            { className: 'dshad_row' },
            React.createElement('div', { className: 'dshad_rowLabel' }, t('stateRoot')),
            React.createElement('div', { className: 'dshad_rowValue dshad_rowValueMono' }, report?.stateRoot ?? t('unknown')),
          ),
          React.createElement(
            'div',
            { className: 'dshad_row' },
            React.createElement('div', { className: 'dshad_rowLabel' }, t('lastCheck')),
            React.createElement(
              'div',
              { className: 'dshad_rowValue' },
              typeof report?.lastCheckAt === 'number'
                ? new Date(report.lastCheckAt).toLocaleString()
                : t('never'),
            ),
          ),
        ),
        React.createElement(
          'div',
          { className: 'dshad_actions' },
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dshad_button dshad_buttonPrimary',
              disabled: busy,
              onClick: () => void act({ action: 'update-now' }).then(() => setStatus('updated')),
            },
            t('update'),
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dshad_button',
              disabled: busy,
              onClick: () => void act({ action: 'check' }),
            },
            t('check'),
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dshad_button',
              disabled: busy,
              onClick: () => {
                setHealth(null)
                void act({ action: 'health-check' })
              },
            },
            t('health'),
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              className: 'dshad_button',
              disabled: busy,
              onClick: async () => {
                if (busy) return
                setBusy(true)
                try {
                  const answer = await send({ action: 'guide', scope: 'desktop' })
                  setGuide(typeof answer?.guide === 'string' ? answer.guide : '')
                } catch (failure) {
                  setError(failure instanceof Error ? failure.message : String(failure))
                } finally {
                  setBusy(false)
                }
              },
            },
            t('guide'),
          ),
          busy ? React.createElement('span', { className: 'dshad_status', role: 'status' }, t('busy')) : null,
          status.length > 0 ? React.createElement('span', { className: 'dshad_status dshad_statusOk' }, status) : null,
        ),
        React.createElement('hr', { className: 'dshad_separator' }),
        React.createElement(
          'div',
          { className: 'dshad_switchRow' },
          React.createElement(
            'button',
            {
              type: 'button',
              role: 'switch',
              className: 'dshad_switch',
              'aria-checked': report?.autoUpdate === true ? 'true' : 'false',
              'aria-label': t('autoUpdate'),
              disabled: busy || report === null,
              onClick: () => {
                const next = report?.autoUpdate !== true
                setReport((current) => (current === null ? current : { ...current, autoUpdate: next }))
                void act({ action: 'set-auto-update', enabled: next })
              },
            },
            React.createElement('span', { className: 'dshad_switchKnob' }),
          ),
          React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'dshad_label' }, t('autoUpdate')),
            React.createElement('div', { className: 'dshad_hint' }, t('autoUpdateHint')),
          ),
        ),
        React.createElement('hr', { className: 'dshad_separator' }),
        React.createElement(
          'div',
          null,
          React.createElement('div', { className: 'dshad_label' }, t('tools')),
          React.createElement('div', { className: 'dshad_hint' }, t('toolsHint')),
          React.createElement(
            'div',
            { className: 'dshad_tools', style: { marginTop: '8px' } },
            tools.map((name) => React.createElement('span', { key: name, className: 'dshad_tool' }, name)),
          ),
        ),
        health
          ? React.createElement(
            'pre',
            { className: 'dshad_pre' },
            JSON.stringify(health, null, 2),
          )
          : null,
        guide.length > 0
          ? React.createElement(
            'div',
            null,
            React.createElement('div', { className: 'dshad_label' }, t('guideTitle')),
            React.createElement('pre', { className: 'dshad_pre', style: { marginTop: '8px' } }, guide),
          )
          : null,
      )
    }

    const apply = (ctx) => {
      const t = ctx.locale.bind(NS)
      translate = (key, values) => t(key, values)
      ctx.effect(() => ctx.locale.register(NS, { en, th, zh }), 'ui-agent-desktop: dictionaries')
      ctx.slots.inject('settings.section', () => ctx.slots.register({
        name: 'settings.section',
        id: 'agent-desktop',
        order: 22,
        label: () => t('nav'),
        locale: NS,
      }, AgentDesktopSection))
      ctx.slots.inject('settings.section.icon', () => ctx.slots.register({
        name: 'settings.section.icon',
        id: 'agent-desktop',
        order: 0,
        locale: NS,
      }, SectionIcon))
    }

    return { inject: ['slots', 'locale'], apply }
  },
})
