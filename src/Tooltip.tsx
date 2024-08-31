import { styled } from '@mui/material/styles';
import { tooltipClasses, TooltipProps, default as MuiTooltip } from '@mui/material/Tooltip';

const Tooltip = styled(
  ({ className, children, ...props }: TooltipProps) =>
    <MuiTooltip arrow {...props} classes={{ popper: className, }}>{children}</MuiTooltip>
)(
  () => ({
    [`& .${tooltipClasses.tooltip}`]: {
      fontSize: "0.9em",
    },
  })
)

export default Tooltip
