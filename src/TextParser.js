let Text = require('./Text'),
	Address = require('./Address'),
	Ref = require('./Ref'),
	Warning = require('./Warning');

// To parse for a specific text string
class TextParser {
	constructor( disassembly, addr ){
		this.disassembly = disassembly;
		this.addr = addr;
		
		// Pull some data from the disassembly
		this.ROM = disassembly.ROM;
		this.EOS = disassembly.EOS;
		this.ByteToChar = disassembly.ByteToChar;
		
		// Initialize the parser data
		this.index = addr;
		this.doFork = false;
		
		// Create the head Text node
		this.Head = this.Text = new Text( this, addr );
		this.disassembly.ROMRefs.set(addr, Ref.DATA);
		
		// Begin parsing
		this.parse();
		
		this.finalize();
		
		if( this.doFork ){
			new TextParser( disassembly, this.index );
		}
	}
	
	parse(){
		do {
			var value = this.ROM[this.index];
			
			if( this.ByteToChar.has(value) ){
				let ch = this.ByteToChar.get(value);
				this.Text.addContent(ch);
			}
			else{
				Warning(`Unmapped char (0x${ Address.format(value, 2) }) encountered while parsing string at ${ Address.toBankString(this.addr, 'rom') }`);
				break;
			}
			
			this.index += 1;
		} while( this.doContinue(value) );
	}
	
	/* Don't continue if:
		- the value is an EOS symbol
		- the bank has ended
		- the address is a string
		- the address has already been parsed or is a 'main'
	*/
	doContinue(value){
		let ref = this.disassembly.ROMRefs.get(this.index);
		
		if( this.EOS.has(value) ){
			return false;
		}
		if( !(this.index % 0x4000) ){
			Warning(`End of bank reached while parsing string at ${ Address.toBankString(this.addr, 'rom') }`);
			return false;
		}
		
		if( ref === Ref.MAIN ){
			Warning(`Sym address reached while parsing string at ${ Address.toBankString(this.addr, 'rom') }, so terminating`);
			return false;
		}
		
		let node = this.disassembly.ParsedContent.has(this.index);
		
		if( node ){
			if( node.type !== 'Text' ){
				Warning(`Start of ${ node.type } encountered while parsing string at ${ Address.toBankString(this.addr, 'rom') }, so terminating`);
			}
			return false;
		}
		
		// Don't check if the address is a 'toParse' location
		// If it is, it will throw an error when trying to parse that content
		if( ref === Ref.DATA || ref === Ref.MAYBE ){
			this.doFork = true;
			return false;
		}
		
		return true;
	}
	
	finalize(){
		this.Text.close( this.index );
		this.Head.store();
	}
}

module.exports = TextParser;