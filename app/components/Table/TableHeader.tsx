import { Link } from "@mui/joy";
import { TableHeaderProps } from "./types";
import { ArrowDropDown, ArrowDropUp } from "@mui/icons-material";


const TableHeader = (props: TableHeaderProps): JSX.Element => {
    
    return (
      <Link
      variant="plain"
      color="neutral"
      endDecorator = {
        (props.orderBy === props.textValue) && (
          props.orderDirection === 'asc' ? <ArrowDropUp /> : <ArrowDropDown />
        )
      }
      sx = {{
        padding: 0,
      }}
      onClick={() => {
        props.handleRequestSort(props.textValue);
      }}
    >
        {props.textValue}
    </Link>
    )
  }

export default TableHeader;