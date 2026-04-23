let ArrayData = [];
var columnStyle_ = null;
var tableData_ = null;
var currentTable = null; // Зберігаємо посилання на таблицю

////////////////////////////////////////////
// Initialize the custom control
WebCC.start(
	// callback function
	function (result) {
		console.log('WebCC.start callback, result:', result);
		if (result) {
			if (WebCC.isDesignMode) {
				console.log('Running in Design Mode');
				ArrayData = JSON.parse("[{\"name\":\"Donald\",\"salary\":\"2000\"},{\"name\":\"Mickey\",\"salary\":\"2100\"}]");
				WebCC.Properties.ColumnStyleString = "[{\"title\":\"Name\", \"field\":\"name\", \"sorter\":\"string\", \"width\":150},{\"title\":\"Salary\", \"field\":\"salary\", \"sorter\":\"number\", \"hozAlign\":\"left\"}]";
				drawTable(true);
			}
			else {
				console.log('Connected successfully in Runtime Mode');
				
				// Ініціалізація властивостей
				setProperty({ key: 'TableDataString', value: WebCC.Properties.TableDataString });
				setProperty({ key: 'ColumnStyleString', value: WebCC.Properties.ColumnStyleString });
				setProperty({ key: 'SelectedRowIndex', value: WebCC.Properties.SelectedRowIndex });

				// Subscribe for value changes
				WebCC.onPropertyChanged.subscribe(setProperty);
			}
		}
		else {
			console.log('connection failed');
		}
	},
	// contract (see also manifest.json)
	{
		// Methods
		methods: {
			DrawTable: function(columnStyleString, tableDataString){
				columnStyle_ = JSON.parse(columnStyleString);
				tableData_ = JSON.parse(tableDataString);
				drawTable(false);
				columnStyle_ = null;
				tableData_ = null;
			}
		},
		// Events
		events: ['RowClick'],
		// Properties
		properties: {
			TableDataString: " ",
			ColumnStyleString: " ",
			SelectedRowIndex: -1
		}
	},
	// placeholder to include additional Unified dependencies
	[],
	// connection timeout
	10000
);

function setProperty(data) {
	console.log('onPropertyChanged ' + data.key + ' = ' + data.value);
	switch (data.key) {
		case 'TableDataString':
			if (data.value && data.value !== " ") {
				ArrayData = JSON.parse(data.value);
				drawTable(true);
			}
			break;
		case 'ColumnStyleString':
			// Можна додати перемальовування при зміні стилю
			break;
		case 'SelectedRowIndex':
			// Логіка, якщо потрібно виділити рядок ззовні (з WinCC)
			break;
	}
}

function drawTable(triggeredByTag) {
	var tabledata, columnStyle;
	
	if (!triggeredByTag) {
		tabledata = tableData_;
		columnStyle = columnStyle_;
	}
	else {
		tabledata = ArrayData;
		try {
			columnStyle = JSON.parse(WebCC.Properties.ColumnStyleString);
		} catch (e) {
			console.error('Error parsing ColumnStyleString', e);
			return;
		}
	}
	
	if (currentTable) {
		currentTable.destroy();
	}
	
	currentTable = new Tabulator("#example-table", {
		height: "100%",
		data: tabledata,
		layout: "fitColumns",
		columns: columnStyle,
		rowClick: function(e, row) {
			try {
				var rowData = row.getData();
				var rowIndex = row.getPosition()+1;
				var rowDataString = JSON.stringify(rowData);
				
				console.log('=== ROW CLICKED ===');
				console.log('Row index:', rowIndex);

				if (typeof WebCC !== 'undefined') {
					// ПРИНЦИП ДІЇ: Записуємо значення у властивість для оновлення тега WinCC
					WebCC.Properties.SelectedRowIndex = rowIndex;
					
					// Викликаємо подію (Event)
					if (WebCC.Events && typeof WebCC.Events.fire === 'function') {
						WebCC.Events.fire('RowClick', rowDataString, rowIndex);
						console.log('✅ Event and Property update triggered');
					}
				}
			} catch (error) {
				console.error('Error in rowClick handler:', error);
			}
		}
	});
}