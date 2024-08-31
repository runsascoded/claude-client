import { FormEvent, useEffect, useState, KeyboardEvent, } from 'react'
import './App.css'
import Anthropic from "@anthropic-ai/sdk"
import useLocalStorageState from "use-local-storage-state"
import { useQuery } from "react-query"
type Message = Anthropic.Message;

const TokenKey = "anthropic-token"
const PromptKey = "anthropic-prompt"

function Message(msg: Message) {
  const { content } = msg
  return <div className={"message"}>
    <h2>Response:</h2>
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
function App() {
  const [ token, setToken ] = useLocalStorageState<string | null>(TokenKey, { defaultValue: null })
  const [ anthropic, setAnthropic ] = useState<Anthropic | null>(null)
  const [ prompt, setPrompt ] = useLocalStorageState(PromptKey, { defaultValue: "" })
  const [ submitPrompt, setSubmitPrompt ] = useState("")

  useEffect(() => {
    const anthropic = new Anthropic({ apiKey: token, dangerouslyAllowBrowser: true })
    setAnthropic(anthropic)
  }, [token])

  const response = useQuery({
    queryKey: ['query', token, submitPrompt],
    queryFn: async () => {
      if (!anthropic || !submitPrompt) {
        return
      }
      const message = await anthropic.messages.create({
        messages: [{ content: submitPrompt, role: "user" }],
        model: "claude-3-5-sonnet-20240620",
        system: "Respond only with short poems.",
        max_tokens: 100,
        temperature: 0,
      })
      console.log("anthropic response", message)
      return message
    },
  })
  const { data, refetch, isLoading, isError, error } = response
  console.log("response", response)

  const handleSubmit = (e?: FormEvent<HTMLFormElement>) => {
    e?.preventDefault()
    setSubmitPrompt(prompt)
    refetch()
    console.log("submitting prompt", prompt)
  }

  const handleKeyPress = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div>
      <h1>Claude client</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label>
            <h2>Query:</h2>
            <textarea
              cols={50}
              rows={5}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyPress}
            />
          </label>
        </div>
        <div>
          <button type="submit">Submit</button>
        </div>
        <div>
          {isLoading && <p>Loading...</p>}
          {isError && <p>Error: {(error as Error).message}</p>}
          {data && <Message {...data} />}
        </div>
        <div>
          <label>
            Token:
            <input
              type="password"
              value={token ?? ""}
              onChange={(e) => setToken(e.target.value)}
            />
          </label>
        </div>
      </form>
    </div>
  )
}

export default App
