import { FormEvent, HTMLProps, KeyboardEvent, useCallback, useEffect, useState, } from 'react'
import './App.css'
import Anthropic from "@anthropic-ai/sdk"
import useLocalStorageState from "use-local-storage-state"
import { useQuery } from "@tanstack/react-query"

import { State } from "@rdub/base/state";
import Tooltip from "./Tooltip.tsx";
import GitHub from "./Github.tsx";
import A from "@rdub/base/a";

type Message = Anthropic.Message;

const TokenKey = "anthropic-token"
const PromptKey = "anthropic-prompt"
const SystemPromptKey = "anthropic-system-prompt"
const ModelKey = "anthropic-model"

const DefaultPrompt = "What is a Claude?"
const DefaultSystemPrompt = "Respond only with short poems."
const DefaultModel = "claude-3-5-sonnet-20240620"
const MaxTokensKey = "anthropic-max-tokens"
const DefaultMaxTokens = 100
const TemperatureKey = "anthropic-temperature"
const DefaultTemperature = 1

const H = 'h3'

function Div({ children, ...props }: HTMLProps<HTMLDivElement>) {
  return <div className={"section"} {...props}>{children}</div>
}

type Input<T = string> = State<T, "val"> & State<T, "saved">

function useInput<T = string>({ k, init }: { k: string, init: T }): Input<T> {
  const [ val, setVal ] = useLocalStorageState(k, { defaultValue: init })
  const [ saved, setSaved ] = useState(val)
  return { val, setVal, saved, setSaved, }
}

function Prompt(
  {
    k, title,
    input: { val, setVal, setSaved, },
    handleSubmit,
    cols = 50, rows = 5,
    ...props
  }: {
    k: string
    title: string
    input: Input
    handleSubmit?: () => void
    init?: string
  } & HTMLProps<HTMLTextAreaElement>
) {
  const handleKeyPress = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setSaved(val)
        if (handleSubmit) {
          handleSubmit()
        }
      }
    },
    [ val, setSaved, ]
  )
  return (
    <Div>
      <label>
        <H>{title}</H>
        <textarea
          className={"prompt"}
          rows={rows}
          cols={cols}
          {...props}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={handleKeyPress}
        />
      </label>
    </Div>
  )
}

function Num({ label, val, setVal, ...props }: State<number, "val"> & { label: string } & HTMLProps<HTMLInputElement>) {
  return (
    <Div>
      <label>
        <span>{label}:</span>
        <input
          type="number"
          {...props}
          value={val}
          onChange={e => setVal(parseInt(e.target.value))}
        />
      </label>
    </Div>
  )
}

function Message(msg: Message) {
  const { content } = msg
  return <div className={"message"}>
    <H>Response:</H>
    {
      content.map((block, idx) =>
        block.type === "text" ?
          <div key={idx} className={"lines"}>{block.text.split("\n").map(
            (line, lineno) => <p key={`line-${lineno}`} className={"line"}>{line}</p>
          )}</div> :
          <pre key={idx}>{JSON.stringify(block, null, 2)}</pre>
      )
    }
    <details>
      <summary>Raw</summary>
      <pre className={"data"}>{JSON.stringify(msg, null, 2)}</pre>
    </details>
  </div>
}

function Token({ token, setToken }: State<string, "token">) {
  return <Div>
    <Tooltip
      // open
      title={<div>
        <p>Only stored in browser <code>localStorage.</code></p>
        <a href={"https://console.anthropic.com/dashboard"} target={"_blank"} rel={"noreferrer"}>
          Get a token from the Anthropic dashboard.
        </a>
      </div>}
      className={"menu"}
    >
      <label htmlFor={"token"}>
        <span>Token:</span>
      </label>
    </Tooltip>
    <input
      id={"token"}
      type="password"
      value={token ?? ""}
      onChange={(e) => setToken(e.target.value)}
    />
  </Div>
}

function Submit({ disabled, ...props }: Omit<HTMLProps<HTMLButtonElement>, "type">) {
  const button = <button type="submit" disabled={disabled} {...props}>Submit</button>
  return <Div>{
    disabled ? <Tooltip title={"Prompt, system prompt, and token required to submit."}><span>{button}</span></Tooltip> : button
  }</Div>
}

function App() {
  const [ token, setToken ] = useLocalStorageState<string>(TokenKey, { defaultValue: "" })
  const [ anthropic, setAnthropic ] = useState<Anthropic | null>(null)
  const prompt = useInput({ k: PromptKey, init: DefaultPrompt, })
  const system = useInput({ k: SystemPromptKey, init: DefaultSystemPrompt })
  const tokens = useInput({ k: MaxTokensKey, init: DefaultMaxTokens })
  const model = useInput({ k: ModelKey, init: DefaultModel })
  const temperature = useInput({ k: TemperatureKey, init: DefaultTemperature })
  const [ nonce, setNonce ] = useState(0)
  useEffect(() => {
    if (!token) {
      setAnthropic(null)
      return
    }
    const anthropic = new Anthropic({ apiKey: token, dangerouslyAllowBrowser: true })
    setAnthropic(anthropic)
  }, [token])

  const response = useQuery({
    queryKey: [ 'query', anthropic?.apiKey, prompt.saved, system.saved, model.saved, tokens.saved, temperature.saved, nonce, ],
    queryFn: async () => {
      if (!anthropic || !prompt.saved || !system.saved) {
        return null
      }
      const message = await anthropic.messages.create({
        messages: [{ content: prompt.saved, role: "user" }],
        model: model.saved,
        system: system.saved,
        max_tokens: tokens.saved,
        temperature: temperature.saved,
      })
      console.log("anthropic response", message)
      return message
    },
  })
  const { data, refetch, isLoading, isError, error } = response
  // console.log("response", response)

  const handleSubmit = useCallback(
    (e?: FormEvent<HTMLFormElement>) => {
      e?.preventDefault();
      ([ prompt, system, tokens, model, temperature ] as Input<any>[]).forEach(({ saved, val, setSaved }) => {
        if (saved !== val) {
          setSaved(val)
        }
      })
      setNonce(prevNonce => prevNonce + 1)
      console.log("handleSubmit:", { prompt, system, tokens, model, temperature, nonce, })
    },
    [ refetch, prompt, system, tokens, model, temperature, nonce, setNonce, ]
  )

  return (
    <div>
      <h2>Client-only interface to <A href={"https://claude.ai/"}>Claude</A></h2>
      <form onSubmit={handleSubmit}>
        <Prompt handleSubmit={handleSubmit} title={"Prompt"} k={PromptKey} input={prompt} />
        <Prompt handleSubmit={handleSubmit} title={"System prompt"} k={SystemPromptKey} input={system} rows={2} />
        <Submit disabled={!token || !prompt.saved || !system.saved} />
        <Div>
          {isLoading && <p>Loading...</p>}
          {isError && <p>Error: {(error as Error).message}</p>}
          {data && <Message {...data} />}
        </Div>
        <Token token={token} setToken={val => {
          setToken(val)
          setNonce(prevNonce => prevNonce + 1)
        }} />
        <Div>
          <label>
            <span>Model:</span>
            <input
              type="text"
              className={"model"}
              value={model.val}
              onChange={(e) => model.setVal(e.target.value)}
            />
          </label>
        </Div>
        <Num label={"Max Tokens"} className={"max-tokens"} val={tokens.val} setVal={tokens.setVal} />
        <Num label={"Temperature"} className={"temperature"} val={temperature.val} setVal={temperature.setVal} />
      </form>
      <Div>
        <GitHub w={40} />
      </Div>
    </div>
  )
}

export default App
