import { useRouter } from './router'

export function Link({ to, className, children, ...rest }) {
  const { navigate } = useRouter()
  return (
    <a
      href={'#' + to}
      className={className}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        navigate(to)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
